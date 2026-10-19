import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FlatDraft } from '../domain/flat'
import {
  createFlat,
  deleteCompletion,
  findFlatIdByCode,
  joinFlat,
  listMembers,
  saveCompletion,
  setTricountUrl,
  subscribeCompletions,
  subscribeFlat,
  subscribeMembers,
  type CompletionRecord,
  type FlatRecord,
  type MemberRecord,
} from './flatRepository'

// Runs against the Firestore emulator with the production rules: `npm run test:rules`.
const OWNER = 'owner-uid'
const FLATMATE = 'flatmate-uid'
const STRANGER = 'stranger-uid'

const draft: FlatDraft = {
  name: 'My flat',
  members: ['Ana', 'Ben', 'Carl'],
  zones: ['Living room', 'Kitchen', 'Bathroom'],
  startDate: '2026-10-12',
}

let env: RulesTestEnvironment
const db = (uid: string) => env.authenticatedContext(uid).firestore()

const create = (code = 'ABC123') =>
  createFlat(db(OWNER), {
    draft,
    ownerUid: OWNER,
    ownerName: 'Ana',
    generateCode: () => code,
  })

// Resolves with the first value that satisfies the predicate.
const waitFor = <T>(
  subscribe: (callback: (value: T) => void) => () => void,
  predicate: (value: T) => boolean,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for a value')), 5000)
    const unsubscribe = subscribe((value) => {
      if (predicate(value)) {
        clearTimeout(timer)
        unsubscribe()
        resolve(value)
      }
    })
  })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-housely',
    firestore: { rules: readFileSync('firestore/firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('createFlat', () => {
  it('creates the flat, its members, the owner membership and the invite code', async () => {
    const { flatId, memberId, inviteCode } = await create()
    expect(inviteCode).toBe('ABC123')

    const members = await listMembers(db(OWNER), flatId)
    expect(members.map((member) => member.name).sort()).toEqual(['Ana', 'Ben', 'Carl'])
    const owner = members.find((member) => member.id === memberId)
    expect(owner).toMatchObject({ name: 'Ana', uid: OWNER, active: true })
    expect(members.filter((member) => member.uid === null)).toHaveLength(2)

    const flat = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(OWNER), flatId, callback, () => {}),
      (value) => value !== null,
    )
    expect(flat).toMatchObject({
      name: 'My flat',
      startDate: '2026-10-12',
      zones: draft.zones,
      inviteCode: 'ABC123',
      ownerUid: OWNER,
    })
  })

  it('gives every member a color', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    expect(members.every((member) => /^#[0-9a-f]{6}$/i.test(member.color))).toBe(true)
  })

  it('retries with a new code when the invite code is already taken', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes/TAKEN1'), {
        flatId: 'other',
        ownerUid: 'someone',
      })
    })
    const codes = ['TAKEN1', 'FRESH2']
    const { inviteCode } = await createFlat(db(OWNER), {
      draft,
      ownerUid: OWNER,
      ownerName: 'Ana',
      generateCode: () => codes.shift() ?? 'LAST99',
    })
    expect(inviteCode).toBe('FRESH2')
  })

  it('rejects an owner name that is not one of the members', async () => {
    await expect(
      createFlat(db(OWNER), {
        draft,
        ownerUid: OWNER,
        ownerName: 'Zed',
        generateCode: () => 'ABC123',
      }),
    ).rejects.toThrow(/owner/i)
  })

  it('rejects an invalid draft before touching Firestore', async () => {
    await expect(
      createFlat(db(OWNER), {
        draft: { ...draft, zones: [] },
        ownerUid: OWNER,
        ownerName: 'Ana',
        generateCode: () => 'ABC123',
      }),
    ).rejects.toThrow(/zones-required/)
  })
})

describe('findFlatIdByCode', () => {
  it('resolves a code ignoring case and spaces', async () => {
    const { flatId } = await create()
    expect(await findFlatIdByCode(db(STRANGER), ' abc123 ')).toBe(flatId)
  })

  it('returns null for an unknown code', async () => {
    expect(await findFlatIdByCode(db(STRANGER), 'NOPE22')).toBeNull()
  })
})

describe('joinFlat', () => {
  it('lets a flatmate pick an unclaimed member and then read the flat', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(FLATMATE), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord

    await assertFails(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(db(FLATMATE), flatId, () => resolve(), reject),
      ),
    )

    await assertSucceeds(joinFlat(db(FLATMATE), { flatId, memberId: ben.id, uid: FLATMATE }))

    const flat = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(FLATMATE), flatId, callback, () => {}),
      (value) => value !== null,
    )
    expect(flat?.name).toBe('My flat')
    const updated = await listMembers(db(FLATMATE), flatId)
    expect(updated.find((member) => member.id === ben.id)?.uid).toBe(FLATMATE)
  })

  it('rejects claiming a member that already belongs to someone', async () => {
    const { flatId, memberId } = await create()
    await assertFails(joinFlat(db(STRANGER), { flatId, memberId, uid: STRANGER }))
  })
})

describe('completions', () => {
  const completion = (memberId: string): CompletionRecord => ({
    weekIndex: 2,
    zone: 'Kitchen',
    memberId,
    doneAt: '2026-10-27',
  })

  it('saves, corrects and deletes the completion of a member', async () => {
    const { flatId, memberId } = await create()
    await assertSucceeds(saveCompletion(db(OWNER), flatId, completion(memberId)))
    await assertSucceeds(
      saveCompletion(db(OWNER), flatId, { ...completion(memberId), doneAt: '2026-10-28' }),
    )

    const saved = await waitFor<CompletionRecord[]>(
      (callback) => subscribeCompletions(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 1,
    )
    expect(saved[0].doneAt).toBe('2026-10-28')

    await assertSucceeds(deleteCompletion(db(OWNER), flatId, 2, 'Kitchen'))
    const empty = await waitFor<CompletionRecord[]>(
      (callback) => subscribeCompletions(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 0,
    )
    expect(empty).toEqual([])
  })

  it('rejects a completion from someone who is not a member', async () => {
    const { flatId, memberId } = await create()
    await assertFails(saveCompletion(db(STRANGER), flatId, completion(memberId)))
  })
})

describe('subscribeMembers', () => {
  it('streams the members of the flat', async () => {
    const { flatId } = await create()
    const members = await waitFor<MemberRecord[]>(
      (callback) => subscribeMembers(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 3,
    )
    expect(members).toHaveLength(3)
  })
})

describe('setTricountUrl', () => {
  it('lets the owner set and clear the Tricount link', async () => {
    const { flatId } = await create()
    await assertSucceeds(setTricountUrl(db(OWNER), flatId, 'https://tricount.com/abc'))
    const withLink = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(OWNER), flatId, callback, () => {}),
      (value) => value?.tricountUrl !== undefined,
    )
    expect(withLink?.tricountUrl).toBe('https://tricount.com/abc')

    await assertSucceeds(setTricountUrl(db(OWNER), flatId, null))
    const cleared = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(OWNER), flatId, callback, () => {}),
      (value) => value !== null && value.tricountUrl === undefined,
    )
    expect(cleared?.tricountUrl).toBeUndefined()
  })

  it('rejects non-owners and links that are not https', async () => {
    const { flatId } = await create()
    await assertFails(setTricountUrl(db(STRANGER), flatId, 'https://tricount.com/abc'))
    await assertFails(setTricountUrl(db(OWNER), flatId, 'http://tricount.com/abc'))
  })
})
