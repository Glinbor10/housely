import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import {
  MAX_FLATS_PER_IDENTITY,
  normalizeDraft,
  validateDraft,
  type FlatDraft,
} from '../domain/flat'

export interface FlatRecord {
  id: string
  name: string
  startDate: string
  zones: string[]
  inviteCode: string
  ownerUid: string
  tricountUrl?: string
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
  generateCode: () => string
}

export interface CreatedFlat {
  flatId: string
  memberId: string
  inviteCode: string
}

type ErrorCallback = (error: Error) => void

const MEMBER_COLORS = [
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#d32f2f',
  '#0097a7',
  '#5d4037',
  '#455a64',
]
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

export class FlatLimitError extends Error {
  constructor() {
    super(
      `You can create up to ${MAX_FLATS_PER_IDENTITY} flats from this device. Join an existing flat with its invite code instead.`,
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
  batch.set(flat, {
    name: draft.name,
    startDate: draft.startDate,
    zones: draft.zones,
    inviteCode,
    ownerUid: input.ownerUid,
    createdAt: serverTimestamp(),
  })

  let ownerMemberId = ''
  draft.members.forEach((name, index) => {
    // Ids m0 to m19 follow the order: the rules use them to cap a flat at 20 people
    const member = doc(flat, 'members', `m${index}`)
    const isOwner = index === ownerIndex
    if (isOwner) ownerMemberId = member.id
    batch.set(member, {
      name,
      color: MEMBER_COLORS[index % MEMBER_COLORS.length],
      uid: isOwner ? input.ownerUid : null,
      active: true,
      order: index,
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
  input: { flatId: string; memberId: string; uid: string; flatName: string },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  const batch = writeBatch(db)
  batch.update(doc(flat, 'members', input.memberId), { uid: input.uid })
  batch.set(doc(flat, 'users', input.uid), { memberId: input.memberId })
  batch.set(doc(db, 'userFlats', input.uid, 'flats', input.flatId), {
    memberId: input.memberId,
    flatName: input.flatName,
  })
  await batch.commit()
}

// Frees a member whose device was lost: the member is unclaimed and the old membership removed in
// one batch, so the person can rejoin from a new phone with the invite code.
export const releaseMember = async (
  db: Firestore,
  input: { flatId: string; memberId: string; uid: string },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  const batch = writeBatch(db)
  batch.update(doc(flat, 'members', input.memberId), { uid: null })
  batch.delete(doc(flat, 'users', input.uid))
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
): (() => void) =>
  onSnapshot(
    collection(flatRef(db, flatId), 'completions'),
    (snapshot) =>
      onChange(snapshot.docs.map((completion) => completion.data() as CompletionRecord)),
    onError,
  )

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
