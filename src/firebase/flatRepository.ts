import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import {
  cleanText,
  MAX_FLATS_PER_IDENTITY,
  normalizeDraft,
  validateDraft,
  validateFlatName,
  type FlatDraft,
} from '../domain/flat'
import { addMonths } from '../domain/dates'
import type { RotationLayout } from '../domain/layouts'
import { colorForPerson, colorsForPeople } from '../domain/palette'
import type { RotationPlan } from '../domain/rotationEdit'
import type { Expense } from '../domain/expenses'
import { settlementId, type Settlement } from '../domain/settlements'
import { takeoverId, type Takeover } from '../domain/takeovers'
import type { LocalizedError } from '../i18n/describeError'
export interface PeriodClose {
  // When expenses will next be reset, YYYY-MM-DD
  nextCloseDate: string
  // How often the period closes, in months
  intervalMonths: number
  // When the previous period was closed, YYYY-MM-DD; expenses from this date forward are shown
  lastClosedAt?: string
}

export interface FlatRecord {
  id: string
  name: string
  startDate: string
  zones: string[]
  // The zones in force before the last rotation edit: still valid until the new layout starts
  previousZones?: string[]
  inviteCode: string
  ownerUid: string
  tricountUrl?: string
  periodClose?: PeriodClose
  // The owner is deleting the flat: it is being emptied and may be left half way
  deleting?: boolean
}

export interface MemberRecord {
  id: string
  name: string
  color: string
  // Anonymous identity that claimed the member, null while nobody has
  uid: string | null
  active: boolean
  // Position in the rotation: members are always listed in the order they were entered
  order: number
  // The person has Google linked, so they can be made owner without risk of losing the flat
  hasGoogle?: boolean
}

export interface CompletionRecord {
  weekIndex: number
  zone: string
  memberId: string
  // Local calendar date, YYYY-MM-DD
  doneAt: string
}

export interface CreateFlatInput {
  draft: FlatDraft
  ownerUid: string
  // Which of the draft members the creator is
  ownerName: string
  // The color the creator chose; the others take the palette in order without it
  ownerColor?: string
  generateCode: () => string
}

export interface CreatedFlat {
  flatId: string
  memberId: string
  inviteCode: string
}

type ErrorCallback = (error: Error) => void

const MAX_CODE_ATTEMPTS = 10

const normalizeCode = (code: string): string => code.trim().toUpperCase()

const flatRef = (db: Firestore, flatId: string) => doc(db, 'flats', flatId)

// An invite code can only be created once (the rules forbid updates), so check before using it.
const pickFreeCode = async (db: Firestore, generateCode: () => string): Promise<string> => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = normalizeCode(generateCode())
    if (!(await getDoc(doc(db, 'inviteCodes', code))).exists()) return code
  }
  throw new Error('Could not find a free invite code')
}

export class FlatLimitError extends Error implements LocalizedError {
  readonly messageKey = 'create.flatLimit'
  readonly messageParams = { max: MAX_FLATS_PER_IDENTITY }

  constructor() {
    super(
      `You can create up to ${MAX_FLATS_PER_IDENTITY} flats with this account. Join an existing flat with its invite code instead.`,
    )
    this.name = 'FlatLimitError'
  }
}

// Flat, members, owner membership, invite code and the owner counter are written atomically in one batch.
export const createFlat = async (db: Firestore, input: CreateFlatInput): Promise<CreatedFlat> => {
  const draft = normalizeDraft(input.draft)
  const errors = validateDraft(draft)
  if (errors.length > 0) throw new Error(`Invalid flat: ${errors.join(', ')}`)
  const ownerIndex = draft.members.indexOf(input.ownerName)
  if (ownerIndex === -1) throw new Error('The owner must be one of the members')

  // The rules cap the flats created per identity; checking here gives a clear message instead of a
  // generic permission error, and nothing is written when the limit is reached.
  const ownerCounter = doc(db, 'owners', input.ownerUid)
  const counterSnapshot = await getDoc(ownerCounter)
  const createdBefore = counterSnapshot.exists() ? (counterSnapshot.data().flatCount as number) : 0
  if (createdBefore >= MAX_FLATS_PER_IDENTITY) throw new FlatLimitError()

  const inviteCode = await pickFreeCode(db, input.generateCode)
  const flat = doc(collection(db, 'flats'))
  const batch = writeBatch(db)
  const today = new Date().toISOString().split('T')[0]
  batch.set(flat, {
    name: draft.name,
    startDate: draft.startDate,
    zones: draft.zones,
    inviteCode,
    ownerUid: input.ownerUid,
    createdAt: serverTimestamp(),
    periodClose: {
      nextCloseDate: addMonths(today, 6),
      intervalMonths: 6,
    },
  })

  const colors = colorsForPeople(draft.members.length, ownerIndex, input.ownerColor)
  let ownerMemberId = ''
  draft.members.forEach((name, index) => {
    // Ids m0 to m19 follow the order: the rules use them to cap a flat at 20 people
    const member = doc(flat, 'members', `m${index}`)
    const isOwner = index === ownerIndex
    if (isOwner) ownerMemberId = member.id
    batch.set(member, {
      name,
      color: colors[index],
      uid: isOwner ? input.ownerUid : null,
      active: true,
      order: index,
      // Creating a flat requires Google, so the creator always has it
      ...(isOwner ? { hasGoogle: true } : {}),
    })
  })

  batch.set(doc(flat, 'users', input.ownerUid), { memberId: ownerMemberId })
  batch.set(doc(db, 'inviteCodes', inviteCode), {
    flatId: flat.id,
    ownerUid: input.ownerUid,
    flatName: draft.name,
  })
  batch.set(ownerCounter, { flatCount: createdBefore + 1 })
  // The index that lets the owner find this flat again from a new phone
  batch.set(doc(db, 'userFlats', input.ownerUid, 'flats', flat.id), {
    memberId: ownerMemberId,
    flatName: draft.name,
  })
  await batch.commit()
  return { flatId: flat.id, memberId: ownerMemberId, inviteCode }
}

export interface FoundFlat {
  flatId: string
  flatName: string
}

// The invite code carries the id and the name of the flat, readable before being a member.
export const findFlatByCode = async (db: Firestore, code: string): Promise<FoundFlat | null> => {
  const snapshot = await getDoc(doc(db, 'inviteCodes', normalizeCode(code)))
  if (!snapshot.exists()) return null
  const { flatId, flatName } = snapshot.data()
  return { flatId: flatId as string, flatName: flatName as string }
}

export interface MyFlat {
  flatId: string
  memberId: string
  flatName: string
}

export const listMyFlats = async (db: Firestore, uid: string): Promise<MyFlat[]> => {
  const snapshot = await getDocs(collection(db, 'userFlats', uid, 'flats'))
  return snapshot.docs.map((entry) => ({ flatId: entry.id, ...entry.data() }) as MyFlat)
}

// Forgets an entry that points to a flat the person can no longer open (for example, after being released).
export const forgetFlat = (db: Firestore, uid: string, flatId: string): Promise<void> =>
  deleteDoc(doc(db, 'userFlats', uid, 'flats', flatId))

const byOrder = (a: MemberRecord, b: MemberRecord): number => a.order - b.order

export const listMembers = async (db: Firestore, flatId: string): Promise<MemberRecord[]> => {
  const snapshot = await getDocs(collection(flatRef(db, flatId), 'members'))
  return snapshot.docs
    .map((member) => ({ id: member.id, ...member.data() }) as MemberRecord)
    .sort(byOrder)
}

// Claiming the member and creating the membership must succeed or fail together.
export const joinFlat = async (
  db: Firestore,
  // The color is the one the person chose when joining; without it the member keeps the one it had
  input: {
    flatId: string
    memberId: string
    uid: string
    flatName: string
    color?: string
    // The person already has Google linked when they join
    hasGoogle?: boolean
  },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  const batch = writeBatch(db)
  batch.update(doc(flat, 'members', input.memberId), {
    uid: input.uid,
    ...(input.color === undefined ? {} : { color: input.color }),
    ...(input.hasGoogle ? { hasGoogle: true } : {}),
  })
  batch.set(doc(flat, 'users', input.uid), { memberId: input.memberId })
  batch.set(doc(db, 'userFlats', input.uid, 'flats', input.flatId), {
    memberId: input.memberId,
    flatName: input.flatName,
  })
  await batch.commit()
}

// How long a ticket to move a member to a Google account lives. The rules allow up to ten minutes; the
// phone asks for less because its clock may be ahead of the server's.
const TRANSFER_MINUTES = 8

// The identity that holds a member leaves a one-use ticket before signing in to a Google account that
// already exists. Nobody can read it: whoever shows the secret later can take the member.
export const leaveTransferTicket = (
  db: Firestore,
  input: { flatId: string; memberId: string; uid: string; secret: string },
): Promise<void> =>
  setDoc(doc(flatRef(db, input.flatId), 'transfers', input.memberId), {
    fromUid: input.uid,
    secret: input.secret,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + TRANSFER_MINUTES * 60 * 1000),
  })

// The Google account takes the member of the identity that left the ticket, in one batch: the member,
// the membership, the entry in its list of flats and the end of the old membership.
export const claimTransferTicket = async (
  db: Firestore,
  input: {
    flatId: string
    memberId: string
    fromUid: string
    secret: string
    uid: string
    flatName: string
  },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  const batch = writeBatch(db)
  batch.update(doc(flat, 'transfers', input.memberId), {
    claimedBy: input.uid,
    proof: input.secret,
  })
  batch.update(doc(flat, 'members', input.memberId), { uid: input.uid, hasGoogle: true })
  batch.set(doc(flat, 'users', input.uid), { memberId: input.memberId })
  batch.delete(doc(flat, 'users', input.fromUid))
  batch.set(doc(db, 'userFlats', input.uid, 'flats', input.flatId), {
    memberId: input.memberId,
    flatName: input.flatName,
  })
  await batch.commit()
}

// The ticket has done its job (or failed to): it is removed by the account that claimed it. It only
// has to be tried: one that is left is replaced by the next ticket of the same member.
export const deleteTransferTicket = (
  db: Firestore,
  input: { flatId: string; memberId: string },
): Promise<void> => deleteDoc(doc(flatRef(db, input.flatId), 'transfers', input.memberId))

// Frees a member whose device was lost: the member is unclaimed and the old membership removed in
// one batch, so the person can rejoin from a new phone with the invite code.
export const releaseMember = async (
  db: Firestore,
  input: { flatId: string; memberId: string; uid: string },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  const batch = writeBatch(db)
  // The next person to claim the name may not have Google: the mark goes away with the person
  batch.update(doc(flat, 'members', input.memberId), { uid: null, hasGoogle: deleteField() })
  batch.delete(doc(flat, 'users', input.uid))
  await batch.commit()
}

// Well under the 500 writes of a batch
const DELETE_BATCH_SIZE = 400

const deleteInBatches = async (db: Firestore, references: DocumentReference[]): Promise<void> => {
  for (let start = 0; start < references.length; start += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db)
    references
      .slice(start, start + DELETE_BATCH_SIZE)
      .forEach((reference) => batch.delete(reference))
    await batch.commit()
  }
}

// What a flat holds besides its people: everything the owner can list and remove
const FLAT_DATA = ['completions', 'expenses', 'settlements', 'takeovers', 'layouts'] as const

// Deletes the flat for good, from the app (there are no functions): the owner marks the flat first, which
// is what the rules ask for; then the people, then the data, and in the last batch the flat (with its
// mark), its invite code and the slot of the owner. If it is cut half way the flat still exists with its
// mark, and the owner runs it again. Everything is read from the server: a cache that is behind would
// leave documents behind.
export const deleteFlat = async (
  db: Firestore,
  input: { flatId: string; uid: string; inviteCode: string },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  await updateDoc(flat, { deleting: true })

  // The people go first, together: a membership is never left without its member. The ticket of each
  // member cannot be listed, so it is named by the member (deleting one that is not there is fine)
  const members = await getDocsFromServer(collection(flat, 'members'))
  const people: DocumentReference[] = members.docs.flatMap((member) => {
    const { uid } = member.data()
    return [
      member.ref,
      doc(flat, 'transfers', member.id),
      ...(typeof uid === 'string' && uid !== input.uid ? [doc(flat, 'users', uid)] : []),
    ]
  })
  await deleteInBatches(db, people)

  const data = await Promise.all(FLAT_DATA.map((name) => getDocsFromServer(collection(flat, name))))
  await deleteInBatches(
    db,
    data.flatMap((snapshot) => snapshot.docs.map((entry) => entry.ref)),
  )

  // The owner keeps their own membership until now: it is what lets them read what to delete
  const counterRef = doc(db, 'owners', input.uid)
  const counter = await getDocFromServer(counterRef)
  const batch = writeBatch(db)
  batch.delete(doc(flat, 'users', input.uid))
  batch.delete(flat)
  batch.delete(doc(db, 'inviteCodes', input.inviteCode))
  batch.delete(doc(db, 'userFlats', input.uid, 'flats', input.flatId))
  // The slot comes back, once, for this flat; a counter that was never written has nothing to give back
  const created = counter.exists() ? (counter.data().flatCount as number) : 0
  if (created > 0) batch.set(counterRef, { flatCount: created - 1, freed: input.flatId })
  await batch.commit()
}

export const subscribeFlat = (
  db: Firestore,
  flatId: string,
  onChange: (flat: FlatRecord | null) => void,
  onError: ErrorCallback,
): (() => void) =>
  onSnapshot(
    flatRef(db, flatId),
    (snapshot) =>
      onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as FlatRecord) : null),
    onError,
  )

export const subscribeMembers = (
  db: Firestore,
  flatId: string,
  onChange: (members: MemberRecord[]) => void,
  onError: ErrorCallback,
): (() => void) =>
  onSnapshot(
    collection(flatRef(db, flatId), 'members'),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((member) => ({ id: member.id, ...member.data() }) as MemberRecord)
          .sort(byOrder),
      ),
    onError,
  )

export const subscribeCompletions = (
  db: Firestore,
  flatId: string,
  onChange: (completions: CompletionRecord[]) => void,
  onError: ErrorCallback,
  fromWeekIndex = 0,
): (() => void) => {
  const col = collection(flatRef(db, flatId), 'completions')
  const source = fromWeekIndex > 0 ? query(col, where('weekIndex', '>=', fromWeekIndex)) : col
  return onSnapshot(
    source,
    (snapshot) => onChange(snapshot.docs.map((doc) => doc.data() as CompletionRecord)),
    onError,
  )
}

// One document per week and zone: saving again corrects the date instead of duplicating.
const completionRef = (db: Firestore, flatId: string, weekIndex: number, zone: string) =>
  doc(flatRef(db, flatId), 'completions', `${weekIndex}_${zone}`)

export const saveCompletion = (
  db: Firestore,
  flatId: string,
  completion: CompletionRecord,
): Promise<void> =>
  setDoc(completionRef(db, flatId, completion.weekIndex, completion.zone), completion)

export const deleteCompletion = (
  db: Firestore,
  flatId: string,
  weekIndex: number,
  zone: string,
): Promise<void> => deleteDoc(completionRef(db, flatId, weekIndex, zone))

export const setTricountUrl = (db: Firestore, flatId: string, url: string | null): Promise<void> =>
  updateDoc(flatRef(db, flatId), { tricountUrl: url === null ? deleteField() : url })

export const subscribeLayouts = (
  db: Firestore,
  flatId: string,
  onChange: (layouts: RotationLayout[]) => void,
  onError: ErrorCallback,
): (() => void) =>
  onSnapshot(
    collection(flatRef(db, flatId), 'layouts'),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((layout) => layout.data() as RotationLayout)
          .sort((a, b) => a.fromWeek - b.fromWeek),
      ),
    onError,
  )

// People, zones and layouts change together or not at all: a half applied edit would leave the
// rotation pointing at people or zones that do not exist.
export const saveRotation = async (
  db: Firestore,
  flatId: string,
  plan: RotationPlan,
): Promise<void> => {
  const batch = writeBatch(db)
  const flat = flatRef(db, flatId)
  for (const write of plan.memberWrites) {
    const member = doc(flat, 'members', write.id)
    if (write.isNew) {
      batch.set(member, {
        name: write.name,
        color: colorForPerson(write.order),
        uid: null,
        active: true,
        order: write.order,
      })
    } else {
      batch.update(member, { name: write.name, active: write.active })
    }
  }
  for (const layout of plan.layouts) {
    batch.set(doc(flat, 'layouts', String(layout.fromWeek)), layout)
  }
  batch.update(flat, { zones: plan.zones, previousZones: plan.previousZones })
  await batch.commit()
}

// The person has linked Google: from now on the owner can hand the flat over to them (the rules check
// that the identity really has Google).
export const markMemberHasGoogle = (
  db: Firestore,
  flatId: string,
  memberId: string,
): Promise<void> => updateDoc(doc(flatRef(db, flatId), 'members', memberId), { hasGoogle: true })

// A person picks their own color from the palette (the rules check both things).
export const setMemberColor = (
  db: Firestore,
  flatId: string,
  memberId: string,
  color: string,
): Promise<void> => updateDoc(doc(flatRef(db, flatId), 'members', memberId), { color })

export interface RenameFlatInput {
  flatId: string
  inviteCode: string
  // The owner, and the member they are in the flat
  uid: string
  memberId: string
  name: string
}

// The name lives in three places, written together: the flat, the copy in the invite code (what
// who joins sees) and the entry of the owner in their list of flats. The copies of the rest of the
// people are brought up to date by each one when they open the flat (see syncFlatName).
export const renameFlat = async (db: Firestore, input: RenameFlatInput): Promise<void> => {
  const errors = validateFlatName(input.name)
  if (errors.length > 0) throw new Error(`Invalid flat name: ${errors.join(', ')}`)
  const name = cleanText(input.name)
  const batch = writeBatch(db)
  batch.update(flatRef(db, input.flatId), { name })
  batch.update(doc(db, 'inviteCodes', normalizeCode(input.inviteCode)), { flatName: name })
  batch.set(doc(db, 'userFlats', input.uid, 'flats', input.flatId), {
    memberId: input.memberId,
    flatName: name,
  })
  await batch.commit()
}

const syncedNames = new Set<string>()

// Each person keeps their own copy of the name of the flat, and only they can write it. When the flat
// is open and the name is not the one they have, they correct it: once per name, and quietly.
export const syncFlatName = async (
  db: Firestore,
  uid: string,
  flatId: string,
  name: string,
): Promise<void> => {
  const key = `${uid}/${flatId}/${name}`
  if (syncedNames.has(key)) return
  syncedNames.add(key)
  try {
    const entry = doc(db, 'userFlats', uid, 'flats', flatId)
    const snapshot = await getDoc(entry)
    if (snapshot.exists() && snapshot.data().flatName !== name) {
      await updateDoc(entry, { flatName: name })
    }
  } catch {
    // It will be tried again the next time the flat is opened
    syncedNames.delete(key)
  }
}

export interface HandOverInput {
  flatId: string
  inviteCode: string
  newOwnerUid: string
}

// Ownership moves to a member who has joined. The old owner stays in the flat as one more member.
export const handOverFlat = async (db: Firestore, input: HandOverInput): Promise<void> => {
  const batch = writeBatch(db)
  batch.update(flatRef(db, input.flatId), { ownerUid: input.newOwnerUid })
  batch.update(doc(db, 'inviteCodes', normalizeCode(input.inviteCode)), {
    ownerUid: input.newOwnerUid,
  })
  await batch.commit()
}

export const subscribeSettlements = (
  db: Firestore,
  flatId: string,
  onChange: (settlements: Settlement[]) => void,
  onError: ErrorCallback,
  fromWeekIndex = 0,
): (() => void) => {
  const col = collection(flatRef(db, flatId), 'settlements')
  const source = fromWeekIndex > 0 ? query(col, where('weekIndex', '>=', fromWeekIndex)) : col
  return onSnapshot(
    source,
    (snapshot) =>
      onChange(
        snapshot.docs.map((item) => {
          const { settledAt: _settledAt, ...settlement } = item.data()
          return settlement as Settlement
        }),
      ),
    onError,
  )
}

// Only the fields that have a value are written: Firestore does not accept undefined.
export const saveSettlement = (
  db: Firestore,
  flatId: string,
  settlement: Settlement,
): Promise<void> =>
  setDoc(
    doc(flatRef(db, flatId), 'settlements', settlementId(settlement.weekIndex, settlement.zone)),
    {
      ...Object.fromEntries(Object.entries(settlement).filter(([, value]) => value !== undefined)),
      settledAt: serverTimestamp(),
    },
  )

export const removeSettlement = (
  db: Firestore,
  flatId: string,
  weekIndex: number,
  zone: string,
): Promise<void> =>
  deleteDoc(doc(flatRef(db, flatId), 'settlements', settlementId(weekIndex, zone)))

// A zone of a finished week that is settled by taking a cleaning of a flatmate: the cleaning that is
// taken and the settlement of the zone always go together.
export interface MakeUp {
  takeover: Takeover
  settlement: Settlement
}

export const subscribeTakeovers = (
  db: Firestore,
  flatId: string,
  onChange: (takeovers: Takeover[]) => void,
  onError: ErrorCallback,
  fromWeekIndex = 0,
): (() => void) => {
  const col = collection(flatRef(db, flatId), 'takeovers')
  const source = fromWeekIndex > 0 ? query(col, where('weekIndex', '>=', fromWeekIndex)) : col
  return onSnapshot(
    source,
    (snapshot) =>
      onChange(
        snapshot.docs.map((item) => {
          // The time it was recorded is kept by the rules; the screens do not need it
          const { takenAt: _takenAt, ...takeover } = item.data()
          return takeover as Takeover
        }),
      ),
    onError,
  )
}

export const saveMakeUp = (db: Firestore, flatId: string, makeUp: MakeUp): Promise<void> => {
  const flat = flatRef(db, flatId)
  const { takeover, settlement } = makeUp
  const batch = writeBatch(db)
  batch.set(doc(flat, 'takeovers', takeoverId(takeover.weekIndex, takeover.zone)), {
    ...takeover,
    takenAt: serverTimestamp(),
  })
  batch.set(doc(flat, 'settlements', settlementId(settlement.weekIndex, settlement.zone)), {
    ...Object.fromEntries(Object.entries(settlement).filter(([, value]) => value !== undefined)),
    settledAt: serverTimestamp(),
  })
  return batch.commit()
}

// Takes back the cleaning and the settlement it made, so the zone is missed again
export const removeMakeUp = (db: Firestore, flatId: string, makeUp: MakeUp): Promise<void> => {
  const flat = flatRef(db, flatId)
  const { takeover, settlement } = makeUp
  const batch = writeBatch(db)
  batch.delete(doc(flat, 'takeovers', takeoverId(takeover.weekIndex, takeover.zone)))
  batch.delete(doc(flat, 'settlements', settlementId(settlement.weekIndex, settlement.zone)))
  return batch.commit()
}

// An expense before it has an id: the database gives it one
export type NewExpense = Omit<Expense, 'id'>

const expenseRef = (db: Firestore, flatId: string, expenseId: string) =>
  doc(flatRef(db, flatId), 'expenses', expenseId)

export const subscribeExpenses = (
  db: Firestore,
  flatId: string,
  onChange: (expenses: Expense[]) => void,
  onError: ErrorCallback,
  fromDate?: string,
): (() => void) => {
  const col = collection(flatRef(db, flatId), 'expenses')
  const source = fromDate ? query(col, where('date', '>=', fromDate)) : col
  return onSnapshot(
    source,
    (snapshot) =>
      onChange(
        snapshot.docs.map((item) => {
          // The time it was written is kept by the rules; the screens do not need it
          const { createdAt: _createdAt, ...expense } = item.data()
          return { id: item.id, ...expense } as Expense
        }),
      ),
    onError,
  )
}

// Resolves to the id that the expense got
export const saveExpense = async (
  db: Firestore,
  flatId: string,
  expense: NewExpense,
): Promise<string> => {
  const reference = doc(collection(flatRef(db, flatId), 'expenses'))
  await setDoc(reference, { ...expense, createdAt: serverTimestamp() })
  return reference.id
}

// Only what can change: who wrote it, when, and whether it is a payment never do
export const updateExpense = (db: Firestore, flatId: string, expense: Expense): Promise<void> =>
  updateDoc(expenseRef(db, flatId, expense.id), {
    title: expense.title,
    amountCents: expense.amountCents,
    paidBy: expense.paidBy,
    participants: expense.participants,
    date: expense.date,
  })

export const deleteExpense = (db: Firestore, flatId: string, expenseId: string): Promise<void> =>
  deleteDoc(expenseRef(db, flatId, expenseId))

// Saves (or replaces) the period-close config on the flat. Only the owner calls this.
export const savePeriodClose = (
  db: Firestore,
  flatId: string,
  periodClose: PeriodClose,
): Promise<void> => updateDoc(flatRef(db, flatId), { periodClose })

// Closes the current expense period idempotently. The first caller wins; if the period was already
// closed (lastClosedAt is within the current period), the write is skipped.
export const closePeriod = (
  db: Firestore,
  flatId: string,
  today: string,
  nextCloseDate: string,
): Promise<void> =>
  runTransaction(db, async (tx) => {
    const snap = await tx.get(flatRef(db, flatId))
    const data = snap.data() as FlatRecord | undefined
    if (!data?.periodClose) return
    const { lastClosedAt } = data.periodClose
    // Already closed for this period
    if (lastClosedAt && lastClosedAt >= data.periodClose.nextCloseDate) return
    tx.update(flatRef(db, flatId), {
      'periodClose.lastClosedAt': today,
      'periodClose.nextCloseDate': nextCloseDate,
    })
  })
