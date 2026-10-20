import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FlatDraft } from '../domain/flat'
import rules from '../../firebase/firestore/firestore.rules?raw'
import {
  createFlat,
  FlatLimitError,
  deleteCompletion,
  findFlatByCode,
  forgetFlat,
  listMyFlats,
  joinFlat,
  listMembers,
  releaseMember,
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
// rules-unit-testing types its Firestore with the compat API, but the instance works with the
// modular functions used by the repository, so a single cast bridges the type difference.
const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore

// Identity with Google linked, which is what creating a flat requires
const googleDb = (uid: string) =>
  env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: 'google.com', identities: { 'google.com': [`g-${uid}`] } },
    })
    .firestore() as unknown as Firestore

const create = (code = 'ABC123') =>
  createFlat(googleDb(OWNER), {
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
    firestore: { rules },
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

  it('stores and returns the members in the order they were entered', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    expect(members.map((member) => member.name)).toEqual(['Ana', 'Ben', 'Carl'])
    expect(members.map((member) => member.order)).toEqual([0, 1, 2])
    const streamed = await waitFor<MemberRecord[]>(
      (callback) => subscribeMembers(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 3,
    )
    expect(streamed.map((member) => member.name)).toEqual(['Ana', 'Ben', 'Carl'])
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
    const { inviteCode } = await createFlat(googleDb(OWNER), {
      draft,
      ownerUid: OWNER,
      ownerName: 'Ana',
      generateCode: () => codes.shift() ?? 'LAST99',
    })
    expect(inviteCode).toBe('FRESH2')
  })

  it('rejects an owner name that is not one of the members', async () => {
    await expect(
      createFlat(googleDb(OWNER), {
        draft,
        ownerUid: OWNER,
        ownerName: 'Zed',
        generateCode: () => 'ABC123',
      }),
    ).rejects.toThrow(/owner/i)
  })

  it('rejects an invalid draft before touching Firestore', async () => {
    await expect(
      createFlat(googleDb(OWNER), {
        draft: { ...draft, zones: [] },
        ownerUid: OWNER,
        ownerName: 'Ana',
        generateCode: () => 'ABC123',
      }),
    ).rejects.toThrow(/zones-required/)
  })
})

describe('limits per identity', () => {
  const createWithCode = (uid: string, code: string) =>
    createFlat(googleDb(uid), { draft, ownerUid: uid, ownerName: 'Ana', generateCode: () => code })

  it('stores members with the ids m0, m1, m2 that the rules require', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    expect(members.map((member) => member.id)).toEqual(['m0', 'm1', 'm2'])
  })

  it('counts the flats created by an identity', async () => {
    await createWithCode(OWNER, 'LIMIT1')
    await createWithCode(OWNER, 'LIMIT2')
    const counter = await getDoc(doc(db(OWNER), `owners/${OWNER}`))
    expect(counter.data()).toEqual({ flatCount: 2 })
  })

  it('refuses a fourth flat with an explanation, before writing anything', async () => {
    await createWithCode(OWNER, 'LIMIT1')
    await createWithCode(OWNER, 'LIMIT2')
    await createWithCode(OWNER, 'LIMIT3')
    await expect(createWithCode(OWNER, 'LIMIT4')).rejects.toBeInstanceOf(FlatLimitError)
    await expect(createWithCode(OWNER, 'LIMIT4')).rejects.toThrow(/up to 3 flats/i)
    expect(await findFlatByCode(db(OWNER), 'LIMIT4')).toBeNull()
  })

  it('does not count the flats of other identities', async () => {
    await createWithCode(OWNER, 'LIMIT1')
    await createWithCode(OWNER, 'LIMIT2')
    await createWithCode(OWNER, 'LIMIT3')
    await expect(createWithCode(FLATMATE, 'OTHER1')).resolves.toBeDefined()
  })
})

describe('findFlatByCode', () => {
  it('resolves a code ignoring case and spaces', async () => {
    const { flatId } = await create()
    expect(await findFlatByCode(db(STRANGER), ' abc123 ')).toEqual({ flatId, flatName: 'My flat' })
  })

  it('returns null for an unknown code', async () => {
    expect(await findFlatByCode(db(STRANGER), 'NOPE22')).toBeNull()
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

    await assertSucceeds(
      joinFlat(db(FLATMATE), { flatId, memberId: ben.id, uid: FLATMATE, flatName: 'My flat' }),
    )

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
    await assertFails(
      joinFlat(db(STRANGER), { flatId, memberId, uid: STRANGER, flatName: 'My flat' }),
    )
  })
})

describe('finding your flats', () => {
  it('lists the flats a person created, so they are found again from a new phone', async () => {
    const { flatId, memberId } = await create()
    expect(await listMyFlats(googleDb(OWNER), OWNER)).toEqual([
      { flatId, memberId, flatName: 'My flat' },
    ])
  })

  it('lists the flats a person joined, with the name that the invite code carried', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(FLATMATE), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord
    await joinFlat(db(FLATMATE), { flatId, memberId: ben.id, uid: FLATMATE, flatName: 'My flat' })
    expect(await listMyFlats(db(FLATMATE), FLATMATE)).toEqual([
      { flatId, memberId: ben.id, flatName: 'My flat' },
    ])
  })

  it('lists nothing for a person without flats', async () => {
    expect(await listMyFlats(db(STRANGER), STRANGER)).toEqual([])
  })

  it('never shows the flats of somebody else', async () => {
    await create()
    await assertFails(listMyFlats(db(STRANGER), OWNER))
  })

  it('forgets a stale entry', async () => {
    const { flatId } = await create()
    await forgetFlat(googleDb(OWNER), OWNER, flatId)
    expect(await listMyFlats(googleDb(OWNER), OWNER)).toEqual([])
  })
})

describe('releaseMember', () => {
  const joinBen = async () => {
    const { flatId } = await create()
    const members = await listMembers(db(FLATMATE), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord
    await joinFlat(db(FLATMATE), { flatId, memberId: ben.id, uid: FLATMATE, flatName: 'My flat' })
    return { flatId, ben }
  }

  it('frees the member, removes the access of the old device and lets a new phone rejoin', async () => {
    const { flatId, ben } = await joinBen()
    await assertSucceeds(releaseMember(db(OWNER), { flatId, memberId: ben.id, uid: FLATMATE }))

    const members = await listMembers(db(OWNER), flatId)
    expect(members.find((member) => member.id === ben.id)?.uid).toBeNull()
    await assertFails(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(db(FLATMATE), flatId, () => resolve(), reject),
      ),
    )

    await assertSucceeds(
      joinFlat(db(STRANGER), { flatId, memberId: ben.id, uid: STRANGER, flatName: 'My flat' }),
    )
  })

  it('is only allowed to the owner and never on the own member', async () => {
    const { flatId, ben } = await joinBen()
    await assertFails(releaseMember(db(FLATMATE), { flatId, memberId: ben.id, uid: FLATMATE }))
    const owner = (await listMembers(db(OWNER), flatId)).find((member) => member.uid === OWNER)
    await assertFails(
      releaseMember(db(OWNER), { flatId, memberId: (owner as MemberRecord).id, uid: OWNER }),
    )
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
