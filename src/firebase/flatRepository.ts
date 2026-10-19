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
import { normalizeDraft, validateDraft, type FlatDraft } from '../domain/flat'

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

// Flat, members, owner membership and invite code are written atomically in one batch.
export const createFlat = async (db: Firestore, input: CreateFlatInput): Promise<CreatedFlat> => {
  const draft = normalizeDraft(input.draft)
  const errors = validateDraft(draft)
  if (errors.length > 0) throw new Error(`Invalid flat: ${errors.join(', ')}`)
  const ownerIndex = draft.members.indexOf(input.ownerName)
  if (ownerIndex === -1) throw new Error('The owner must be one of the members')

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
    const member = doc(collection(flat, 'members'))
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
  batch.set(doc(db, 'inviteCodes', inviteCode), { flatId: flat.id, ownerUid: input.ownerUid })
  await batch.commit()
  return { flatId: flat.id, memberId: ownerMemberId, inviteCode }
}

export const findFlatIdByCode = async (db: Firestore, code: string): Promise<string | null> => {
  const snapshot = await getDoc(doc(db, 'inviteCodes', normalizeCode(code)))
  return snapshot.exists() ? (snapshot.data().flatId as string) : null
}

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
  input: { flatId: string; memberId: string; uid: string },
): Promise<void> => {
  const flat = flatRef(db, input.flatId)
  const batch = writeBatch(db)
  batch.update(doc(flat, 'members', input.memberId), { uid: input.uid })
  batch.set(doc(flat, 'users', input.uid), { memberId: input.memberId })
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
