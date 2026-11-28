import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FlatDraft } from '../domain/flat'
import type { RotationLayout } from '../domain/layouts'
import type { Expense } from '../domain/expenses'
import type { Settlement } from '../domain/settlements'
import type { Takeover } from '../domain/takeovers'
import { planRotationEdit } from '../domain/rotationEdit'
import rules from '../../firebase/firestore/firestore.rules?raw'
import {
  createFlat,
  FlatLimitError,
  deleteCompletion,
  deleteFlat,
  findFlatByCode,
  forgetFlat,
  handOverFlat,
  listMyFlats,
  joinFlat,
  leaveTransferTicket,
  markMemberHasGoogle,
  deleteExpense,
  removeMakeUp,
  saveMakeUp,
  listMembers,
  releaseMember,
  renameFlat,
  saveCompletion,
  saveExpense,
  removeSettlement,
  saveRotation,
  saveSettlement,
  setMemberColor,
  setTricountUrl,
  subscribeCompletions,
  subscribeExpenses,
  subscribeFlat,
  subscribeLayouts,
  subscribeMembers,
  subscribeSettlements,
  subscribeTakeovers,
  syncFlatName,
  updateExpense,
  type CompletionRecord,
  type FlatRecord,
  type MakeUp,
  type NewExpense,
  type MemberRecord,
} from './flatRepository'
import { claimTickets, leaveTickets, makeSecret } from './transfer'

// Runs against the Firestore emulator with the production rules: `npm run test:rules`.
const OWNER = 'owner-uid'
const Housemate = 'housemate-uid'
const STRANGER = 'stranger-uid'

const draft: FlatDraft = {
  name: 'My home',
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

// Reads straight from the database, without the rules: withSecurityRulesDisabled gives nothing back
const inspect = async <T>(read: (firestore: Firestore) => Promise<T>): Promise<T> => {
  let result: T | undefined
  await env.withSecurityRulesDisabled(async (context) => {
    result = await read(context.firestore() as unknown as Firestore)
  })
  return result as T
}

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
      name: 'My home',
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
    await expect(createWithCode(Housemate, 'OTHER1')).resolves.toBeDefined()
  })
})

describe('findFlatByCode', () => {
  it('resolves a code ignoring case and spaces', async () => {
    const { flatId } = await create()
    expect(await findFlatByCode(db(STRANGER), ' abc123 ')).toEqual({ flatId, flatName: 'My home' })
  })

  it('returns null for an unknown code', async () => {
    expect(await findFlatByCode(db(STRANGER), 'NOPE22')).toBeNull()
  })
})

describe('createFlat colors', () => {
  it('gives the creator the color they chose and the others the rest in order', async () => {
    const { flatId } = await createFlat(googleDb(OWNER), {
      draft,
      ownerUid: OWNER,
      ownerName: 'Ana',
      ownerColor: '#c2185b',
      generateCode: () => 'COL123',
    })
    const members = await listMembers(googleDb(OWNER), flatId)
    const colors = members.map((member) => member.color)
    expect(members.find((member) => member.name === 'Ana')?.color).toBe('#c2185b')
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('joinFlat', () => {
  it('lets a housemate pick an unclaimed member and then read the flat', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(Housemate), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord

    await assertFails(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(db(Housemate), flatId, () => resolve(), reject),
      ),
    )

    await assertSucceeds(
      joinFlat(db(Housemate), { flatId, memberId: ben.id, uid: Housemate, flatName: 'My home' }),
    )

    const flat = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(Housemate), flatId, callback, () => {}),
      (value) => value !== null,
    )
    expect(flat?.name).toBe('My home')
    const updated = await listMembers(db(Housemate), flatId)
    expect(updated.find((member) => member.id === ben.id)?.uid).toBe(Housemate)
  })

  it('keeps the color the housemate chose when joining', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(Housemate), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord
    await assertSucceeds(
      joinFlat(db(Housemate), {
        flatId,
        memberId: ben.id,
        uid: Housemate,
        flatName: 'My home',
        color: '#c2185b',
      }),
    )
    const updated = await listMembers(db(Housemate), flatId)
    expect(updated.find((member) => member.id === ben.id)?.color).toBe('#c2185b')
  })

  it('rejects claiming a member that already belongs to someone', async () => {
    const { flatId, memberId } = await create()
    await assertFails(
      joinFlat(db(STRANGER), { flatId, memberId, uid: STRANGER, flatName: 'My home' }),
    )
  })
})

describe('finding your homes', () => {
  it('lists the flats a person created, so they are found again from a new phone', async () => {
    const { flatId, memberId } = await create()
    expect(await listMyFlats(googleDb(OWNER), OWNER)).toEqual([
      { flatId, memberId, flatName: 'My home' },
    ])
  })

  it('lists the flats a person joined, with the name that the invite code carried', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(Housemate), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord
    await joinFlat(db(Housemate), { flatId, memberId: ben.id, uid: Housemate, flatName: 'My home' })
    expect(await listMyFlats(db(Housemate), Housemate)).toEqual([
      { flatId, memberId: ben.id, flatName: 'My home' },
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
    const members = await listMembers(db(Housemate), flatId)
    const ben = members.find((member) => member.name === 'Ben') as MemberRecord
    await joinFlat(db(Housemate), { flatId, memberId: ben.id, uid: Housemate, flatName: 'My home' })
    return { flatId, ben }
  }

  it('frees the member, removes the access of the old device and lets a new phone rejoin', async () => {
    const { flatId, ben } = await joinBen()
    await assertSucceeds(releaseMember(db(OWNER), { flatId, memberId: ben.id, uid: Housemate }))

    const members = await listMembers(db(OWNER), flatId)
    expect(members.find((member) => member.id === ben.id)?.uid).toBeNull()
    await assertFails(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(db(Housemate), flatId, () => resolve(), reject),
      ),
    )

    await assertSucceeds(
      joinFlat(db(STRANGER), { flatId, memberId: ben.id, uid: STRANGER, flatName: 'My home' }),
    )
  })

  it('is only allowed to the owner and never on the own member', async () => {
    const { flatId, ben } = await joinBen()
    await assertFails(releaseMember(db(Housemate), { flatId, memberId: ben.id, uid: Housemate }))
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

describe('saveRotation', () => {
  // Edits the rotation of a flat created with Ana, Ben and Carl: Dani joins and Ben leaves
  const edit = async (flatId: string, currentWeek = 2) => {
    const members = await listMembers(db(OWNER), flatId)
    const people = members
      .filter((member) => member.name !== 'Ben')
      .map(({ id, name }) => ({ id, name }))
    const result = planRotationEdit({
      members,
      zones: draft.zones,
      storedLayouts: [],
      currentWeek,
      edit: { people: [...people, { name: 'Dani' }], zones: ['Kitchen', 'Garden'] },
    })
    if (!result.ok) throw new Error(result.errors.join(', '))
    return result.plan
  }

  it('stores the flat as it was and the new layout, adds and deactivates people, and updates the zones', async () => {
    const { flatId } = await create()
    await assertSucceeds(saveRotation(db(OWNER), flatId, await edit(flatId)))

    const layouts = await waitFor<RotationLayout[]>(
      (callback) => subscribeLayouts(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 2,
    )
    expect(layouts.map((layout) => layout.fromWeek)).toEqual([0, 3])
    expect(layouts[0].zones).toEqual(draft.zones)
    expect(layouts[1].zones).toEqual(['Kitchen', 'Garden'])

    const members = await listMembers(db(OWNER), flatId)
    expect(members.find((member) => member.name === 'Dani')).toMatchObject({
      id: 'm3',
      active: true,
      uid: null,
    })
    expect(members.find((member) => member.name === 'Ben')).toMatchObject({ active: false })

    const flat = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(OWNER), flatId, callback, () => {}),
      (value) => value !== null,
    )
    expect(flat?.zones).toEqual(['Kitchen', 'Garden'])
    expect(flat?.previousZones).toEqual(draft.zones)
  })

  it('writes everything or nothing: a rejected layout leaves people and zones as they were', async () => {
    const { flatId } = await create()
    const plan = await edit(flatId)
    // A week beyond the limit makes the rules reject the layout, and with it the whole batch
    const broken = {
      ...plan,
      layouts: plan.layouts.map((layout) => ({ ...layout, fromWeek: 5000 })),
    }
    await assertFails(saveRotation(db(OWNER), flatId, broken))

    const members = await listMembers(db(OWNER), flatId)
    expect(members).toHaveLength(3)
    expect(members.every((member) => member.active)).toBe(true)
  })

  it('is not allowed to a housemate', async () => {
    const { flatId } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    await assertFails(saveRotation(db(Housemate), flatId, await edit(flatId)))
  })

  it('lets the owner edit a housemate who already joined', async () => {
    const { flatId } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    const members = await listMembers(db(OWNER), flatId)
    const result = planRotationEdit({
      members,
      zones: draft.zones,
      storedLayouts: [],
      currentWeek: 0,
      edit: {
        people: members.map(({ id, name }) => ({ id, name: id === ben.id ? 'Benjamin' : name })),
        zones: draft.zones,
      },
    })
    if (!result.ok) throw new Error(result.errors.join(', '))
    await assertSucceeds(saveRotation(db(OWNER), flatId, result.plan))
    const after = await listMembers(db(OWNER), flatId)
    expect(after.find((member) => member.id === ben.id)).toMatchObject({
      name: 'Benjamin',
      uid: Housemate,
    })
  })
})

describe('setMemberColor', () => {
  it('lets a person change their own color, and everybody sees it', async () => {
    const { flatId } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })

    await assertSucceeds(setMemberColor(db(Housemate), flatId, ben.id, '#c2185b'))
    const seen = await waitFor<MemberRecord[]>(
      (callback) => subscribeMembers(db(OWNER), flatId, callback, () => {}),
      (members) => members.some((member) => member.color === '#c2185b'),
    )
    expect(seen.find((member) => member.id === ben.id)?.color).toBe('#c2185b')
  })

  it('refuses a color outside the palette and the color of somebody else', async () => {
    const { flatId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    const ben = members.find((member) => member.name === 'Ben')!
    const carl = members.find((member) => member.name === 'Carl')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })

    await assertFails(setMemberColor(db(Housemate), flatId, ben.id, '#123456'))
    await assertFails(setMemberColor(db(Housemate), flatId, carl.id, '#c2185b'))
  })
})

describe('renameFlat', () => {
  it('renames the flat, its invite code and the name in the list of the owner', async () => {
    const { flatId, memberId, inviteCode } = await create()
    await assertSucceeds(
      renameFlat(googleDb(OWNER), {
        flatId,
        inviteCode,
        uid: OWNER,
        memberId,
        name: '  Calle   Luna 12 ',
      }),
    )

    const flat = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(OWNER), flatId, callback, () => {}),
      (value) => value?.name === 'Calle Luna 12',
    )
    expect(flat?.name).toBe('Calle Luna 12')
    expect(await findFlatByCode(db(STRANGER), inviteCode)).toMatchObject({
      flatName: 'Calle Luna 12',
    })
    expect((await listMyFlats(db(OWNER), OWNER)).map((flat) => flat.flatName)).toEqual([
      'Calle Luna 12',
    ])
  })

  it('refuses an invalid name and anybody but the owner', async () => {
    const { flatId, memberId, inviteCode } = await create()
    await expect(
      renameFlat(db(OWNER), { flatId, inviteCode, uid: OWNER, memberId, name: '   ' }),
    ).rejects.toThrow()
    await assertFails(
      renameFlat(db(STRANGER), { flatId, inviteCode, uid: STRANGER, memberId, name: 'Mine' }),
    )
  })
})

describe('syncFlatName', () => {
  it('brings the name in the list of a person up to date, once, without touching anything else', async () => {
    const { flatId } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    // The owner renamed the flat while Ben was away: his list still has the old name
    await env.withSecurityRulesDisabled((context) =>
      setDoc(
        doc(context.firestore(), `flats/${flatId}`),
        { name: 'Calle Luna 12' },
        { merge: true },
      ),
    )

    await syncFlatName(db(Housemate), Housemate, flatId, 'Calle Luna 12')
    expect(await listMyFlats(db(Housemate), Housemate)).toEqual([
      expect.objectContaining({ flatId, memberId: ben.id, flatName: 'Calle Luna 12' }),
    ])
  })

  it('does nothing for a person who has no entry for that flat', async () => {
    const { flatId } = await create()
    await expect(syncFlatName(db(STRANGER), STRANGER, flatId, 'Whatever')).resolves.toBeUndefined()
    expect(await listMyFlats(db(STRANGER), STRANGER)).toEqual([])
  })
})

describe('handOverFlat', () => {
  // A housemate who joined with Google already linked, so the flat can be handed over to them
  const joinWithGoogle = async (flatId: string) => {
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(googleDb(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
      hasGoogle: true,
    })
    return ben
  }

  it('makes a member who has joined with Google the owner, with the invite code, and keeps the old owner as a member', async () => {
    const { flatId, inviteCode } = await create()
    await joinWithGoogle(flatId)

    await assertSucceeds(handOverFlat(db(OWNER), { flatId, inviteCode, newOwnerUid: Housemate }))
    const flat = await waitFor<FlatRecord | null>(
      (callback) => subscribeFlat(db(Housemate), flatId, callback, () => {}),
      (value) => value?.ownerUid === Housemate,
    )
    expect(flat?.ownerUid).toBe(Housemate)
    // The new owner can now manage the flat, the old one cannot
    await assertSucceeds(setTricountUrl(db(Housemate), flatId, 'https://tricount.com/abc'))
    await assertFails(setTricountUrl(db(OWNER), flatId, 'https://tricount.com/def'))
    // The old owner is still inside
    await assertSucceeds(listMembers(db(OWNER), flatId))
  })

  it('refuses to hand the flat to somebody who has not joined, and to anybody else doing it', async () => {
    const { flatId, inviteCode } = await create()
    await assertFails(handOverFlat(db(OWNER), { flatId, inviteCode, newOwnerUid: STRANGER }))
    await assertFails(handOverFlat(db(STRANGER), { flatId, inviteCode, newOwnerUid: STRANGER }))
  })

  it('refuses to hand the flat to somebody who joined without Google: if they lost the phone nobody could manage it', async () => {
    const { flatId, inviteCode } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })

    await assertFails(handOverFlat(db(OWNER), { flatId, inviteCode, newOwnerUid: Housemate }))
  })

  it('does not let somebody say they have Google when their identity does not', async () => {
    const { flatId } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await assertFails(
      joinFlat(db(Housemate), {
        flatId,
        memberId: ben.id,
        uid: Housemate,
        flatName: draft.name,
        hasGoogle: true,
      }),
    )
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    await assertFails(markMemberHasGoogle(db(Housemate), flatId, ben.id))
  })

  it('lets a housemate who links Google later mark themselves, and then the flat can be handed over to them', async () => {
    const { flatId, inviteCode } = await create()
    const ben = (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })

    await assertSucceeds(markMemberHasGoogle(googleDb(Housemate), flatId, ben.id))
    // Only for themselves
    await assertFails(markMemberHasGoogle(googleDb(STRANGER), flatId, ben.id))

    await assertSucceeds(handOverFlat(db(OWNER), { flatId, inviteCode, newOwnerUid: Housemate }))
  })

  it('marks the creator as having Google, and forgets the mark when a person is released', async () => {
    const { flatId } = await create()
    const before = await listMembers(db(OWNER), flatId)
    expect(before.find((member) => member.name === 'Ana')?.hasGoogle).toBe(true)

    const ben = await joinWithGoogle(flatId)
    await releaseMember(db(OWNER), { flatId, memberId: ben.id, uid: Housemate })
    const after = await listMembers(db(OWNER), flatId)
    expect(after.find((member) => member.id === ben.id)?.hasGoogle).toBeUndefined()
  })
})

describe('settlements', () => {
  // The flat starts on Monday 2026-10-12: weeks 0 and 1 are over, the running one is computed
  const weekMillis = 7 * 24 * 60 * 60 * 1000
  const runningWeek = Math.floor((Date.now() - Date.UTC(2026, 9, 12)) / weekMillis)

  const flatWithBen = async () => {
    const { flatId, memberId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    const ben = members.find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    return { flatId, owner: memberId, ben: ben.id }
  }

  it('lets a member settle a zone and shows it to everybody, in the three ways', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    const away: Settlement = {
      weekIndex: 0,
      zone: 'Kitchen',
      kind: 'away',
      memberId: ben,
      note: 'He was away',
    }
    const late: Settlement = {
      weekIndex: 0,
      zone: 'Bathroom',
      kind: 'late',
      memberId: ben,
      doneAt: '2026-10-16',
    }
    const covered: Settlement = {
      weekIndex: 1,
      zone: 'Kitchen',
      kind: 'covered',
      memberId: ben,
      coveredBy: owner,
    }
    for (const settlement of [away, late, covered]) {
      await assertSucceeds(saveSettlement(db(Housemate), flatId, settlement))
    }

    const seen = await waitFor<Settlement[]>(
      (callback) => subscribeSettlements(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 3,
    )
    expect(seen).toEqual(expect.arrayContaining([away, late, covered]))
  })

  it('refuses the running week and a zone that was done', async () => {
    const { flatId, ben } = await flatWithBen()
    await assertFails(
      saveSettlement(db(Housemate), flatId, {
        weekIndex: runningWeek,
        zone: 'Kitchen',
        kind: 'away',
        memberId: ben,
      }),
    )
    await saveCompletion(db(OWNER), flatId, {
      weekIndex: 0,
      zone: 'Living room',
      memberId: (await listMembers(db(OWNER), flatId)).find((member) => member.name === 'Ana')!.id,
      doneAt: '2026-10-14',
    })
    await assertFails(
      saveSettlement(db(Housemate), flatId, {
        weekIndex: 0,
        zone: 'Living room',
        kind: 'away',
        memberId: ben,
      }),
    )
  })

  it('lets the author or the owner undo it, and nobody else', async () => {
    const { flatId, ben } = await flatWithBen()
    const settlement: Settlement = {
      weekIndex: 0,
      zone: 'Kitchen',
      kind: 'away',
      memberId: ben,
    }
    await saveSettlement(db(Housemate), flatId, settlement)
    await assertFails(removeSettlement(db(STRANGER), flatId, 0, 'Kitchen'))
    await assertSucceeds(removeSettlement(db(Housemate), flatId, 0, 'Kitchen'))

    await saveSettlement(db(Housemate), flatId, settlement)
    await assertSucceeds(removeSettlement(db(OWNER), flatId, 0, 'Kitchen'))
    const left = await waitFor<Settlement[]>(
      (callback) => subscribeSettlements(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 0,
    )
    expect(left).toEqual([])
  })
})

describe('making up with another cleaning', () => {
  const weekMillis = 7 * 24 * 60 * 60 * 1000
  const runningWeek = Math.floor((Date.now() - Date.UTC(2026, 9, 12)) / weekMillis)

  const flatWithBen = async () => {
    const { flatId, memberId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    const ben = members.find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    return { flatId, owner: memberId, ben: ben.id }
  }

  const input = (owner: string, ben: string): MakeUp => ({
    takeover: {
      weekIndex: runningWeek,
      zone: 'Kitchen',
      takerId: ben,
      fromId: owner,
      debtWeek: 0,
      debtZone: 'Bathroom',
    },
    settlement: {
      weekIndex: 0,
      zone: 'Bathroom',
      kind: 'madeUp',
      memberId: ben,
      tookWeek: runningWeek,
      tookZone: 'Kitchen',
      note: 'Making up',
    },
  })

  it('writes the cleaning that was taken and the settlement together, and shows both to everybody', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    const makeUp = input(owner, ben)
    await assertSucceeds(saveMakeUp(db(Housemate), flatId, makeUp))

    const takeovers = await waitFor<Takeover[]>(
      (callback) => subscribeTakeovers(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 1,
    )
    expect(takeovers).toEqual([makeUp.takeover])
    const settlements = await waitFor<Settlement[]>(
      (callback) => subscribeSettlements(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 1,
    )
    expect(settlements).toEqual([makeUp.settlement])
  })

  it('reads only the takeovers from the week that is asked for', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    const makeUp = input(owner, ben)
    await saveMakeUp(db(Housemate), flatId, makeUp)
    const later = makeUp.takeover.weekIndex + 1
    const none = await waitFor<Takeover[]>(
      (callback) => subscribeTakeovers(db(OWNER), flatId, callback, () => {}, later),
      (values) => values.length === 0,
    )
    expect(none).toEqual([])
    const all = await waitFor<Takeover[]>(
      (callback) =>
        subscribeTakeovers(db(OWNER), flatId, callback, () => {}, makeUp.takeover.weekIndex),
      (values) => values.length === 1,
    )
    expect(all).toEqual([makeUp.takeover])
  })

  it('undoes both together, and only the person who took it can', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    const makeUp = input(owner, ben)
    await saveMakeUp(db(Housemate), flatId, makeUp)
    await assertFails(removeMakeUp(db(OWNER), flatId, makeUp))
    await assertSucceeds(removeMakeUp(db(Housemate), flatId, makeUp))
    const left = await waitFor<Takeover[]>(
      (callback) => subscribeTakeovers(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 0,
    )
    expect(left).toEqual([])
  })
})

describe('expenses', () => {
  const flatWithBen = async () => {
    const { flatId, memberId } = await create()
    const members = await listMembers(db(OWNER), flatId)
    const ben = members.find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    return { flatId, owner: memberId, ben: ben.id }
  }
  const newExpense = (owner: string, ben: string): NewExpense => ({
    kind: 'expense',
    title: 'Cleaning products',
    amountCents: 1250,
    paidBy: owner,
    participants: [owner, ben],
    date: '2026-10-20',
    createdBy: owner,
  })

  it('saves an expense that the whole flat sees, with the id that it was given', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    const input = newExpense(owner, ben)
    const id = await saveExpense(db(OWNER), flatId, input)

    const seen = await waitFor<Expense[]>(
      (callback) => subscribeExpenses(db(Housemate), flatId, callback, () => {}),
      (values) => values.length === 1,
    )
    expect(seen).toEqual([{ id, ...input }])
  })

  it('lets the creator change and delete it, and nobody else', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    const input = newExpense(owner, ben)
    const id = await saveExpense(db(OWNER), flatId, input)

    await assertFails(updateExpense(db(Housemate), flatId, { id, ...input, title: 'Mine now' }))
    await assertFails(deleteExpense(db(Housemate), flatId, id))

    await assertSucceeds(
      updateExpense(db(OWNER), flatId, { id, ...input, title: 'Soap', amountCents: 900 }),
    )
    const changed = await waitFor<Expense[]>(
      (callback) => subscribeExpenses(db(OWNER), flatId, callback, () => {}),
      (values) => values[0]?.title === 'Soap',
    )
    expect(changed[0].amountCents).toBe(900)

    await assertSucceeds(deleteExpense(db(OWNER), flatId, id))
    const left = await waitFor<Expense[]>(
      (callback) => subscribeExpenses(db(OWNER), flatId, callback, () => {}),
      (values) => values.length === 0,
    )
    expect(left).toEqual([])
  })

  it('does not accept an expense written in the name of somebody else', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    await assertFails(saveExpense(db(Housemate), flatId, newExpense(owner, ben)))
  })
})

describe('moving the homes of a device to a Google account', () => {
  const OLD = 'old-anonymous-uid'
  const GOOGLE = 'google-account-uid'

  // Ben joins without Google: his member is held by the identity OLD
  const flatWithBenAsOld = async () => {
    const { flatId } = await create()
    const ben = (await listMembers(db(OLD), flatId)).find(
      (member) => member.name === 'Ben',
    ) as MemberRecord
    await joinFlat(db(OLD), { flatId, memberId: ben.id, uid: OLD, flatName: 'My home' })
    return { flatId, ben, saved: [{ flatId, memberId: ben.id, name: 'My home' }] }
  }

  it('makes a secret of 32 hex characters, different each time', () => {
    expect(makeSecret()).toMatch(/^[0-9a-f]{32}$/)
    expect(makeSecret()).not.toBe(makeSecret())
  })

  it('moves the member to the Google account, as the same person', async () => {
    const { flatId, ben, saved } = await flatWithBenAsOld()
    const pending = await leaveTickets(db(OLD), OLD, saved)
    expect(pending).toHaveLength(1)

    const { moved, failed } = await claimTickets(googleDb(GOOGLE), GOOGLE, pending)
    expect(moved.map((flat) => flat.flatId)).toEqual([flatId])
    expect(failed).toEqual([])

    const members = await listMembers(googleDb(GOOGLE), flatId)
    const after = members.find((member) => member.id === ben.id)
    expect(after?.uid).toBe(GOOGLE)
    expect(after?.hasGoogle).toBe(true)
    // The account finds it in its homes, and the old identity can no longer open it
    expect(await listMyFlats(googleDb(GOOGLE), GOOGLE)).toEqual([
      { flatId, memberId: ben.id, flatName: 'My home' },
    ])
    await assertFails(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(db(OLD), flatId, () => resolve(), reject),
      ),
    )
    await assertSucceeds(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(googleDb(GOOGLE), flatId, () => resolve(), reject),
      ),
    )
  })

  it('removes the ticket once the account holds the member', async () => {
    const { flatId, ben, saved } = await flatWithBenAsOld()
    const pending = await leaveTickets(db(OLD), OLD, saved)
    await claimTickets(googleDb(GOOGLE), GOOGLE, pending)
    const ticket = await inspect((firestore) =>
      getDoc(doc(firestore, `flats/${flatId}/transfers/${ben.id}`)),
    )
    expect(ticket.exists()).toBe(false)
  })

  it('moves the homes that can move and leaves the rest', async () => {
    const { saved } = await flatWithBenAsOld()
    // A home that this identity is not a member of cannot leave a ticket
    const stranger = { flatId: 'nobody-knows', memberId: 'm1', name: 'Gone' }
    const pending = await leaveTickets(db(OLD), OLD, [stranger, ...saved])
    expect(pending.map((flat) => flat.flatId)).toEqual([saved[0].flatId])
  })

  it('does not move a home with a wrong secret, and says which one stayed', async () => {
    const { saved } = await flatWithBenAsOld()
    const [pending] = await leaveTickets(db(OLD), OLD, saved)
    const { moved, failed } = await claimTickets(googleDb(GOOGLE), GOOGLE, [
      { ...pending, secret: 'f'.repeat(32) },
    ])
    expect(moved).toEqual([])
    expect(failed).toHaveLength(1)
  })

  it('does not move a home to an account that already is in it as another person', async () => {
    const { flatId, saved } = await flatWithBenAsOld()
    const carl = (await listMembers(db(OLD), flatId)).find(
      (member) => member.name === 'Carl',
    ) as MemberRecord
    await joinFlat(googleDb(GOOGLE), {
      flatId,
      memberId: carl.id,
      uid: GOOGLE,
      flatName: 'My home',
      hasGoogle: true,
    })
    const pending = await leaveTickets(db(OLD), OLD, saved)
    const { moved, failed } = await claimTickets(googleDb(GOOGLE), GOOGLE, pending)
    expect(moved).toEqual([])
    expect(failed).toHaveLength(1)
  })
})

describe('deleting a flat for good', () => {
  const flatWithBen = async (code = 'ABC123') => {
    const { flatId, memberId } = await create(code)
    const members = await listMembers(db(OWNER), flatId)
    const ben = members.find((member) => member.name === 'Ben')!
    await joinFlat(db(Housemate), {
      flatId,
      memberId: ben.id,
      uid: Housemate,
      flatName: draft.name,
    })
    return { flatId, owner: memberId, ben: ben.id }
  }

  const removeInput = (flatId: string, code = 'ABC123') => ({
    flatId,
    uid: OWNER,
    inviteCode: code,
  })

  // Reads what is left, as the server sees it
  const left = (flatId: string) =>
    inspect(async (firestore) => {
      const count = async (path: string) => (await getDocs(collection(firestore, path))).size
      return {
        flat: (await getDoc(doc(firestore, `flats/${flatId}`))).exists(),
        members: await count(`flats/${flatId}/members`),
        users: await count(`flats/${flatId}/users`),
        completions: await count(`flats/${flatId}/completions`),
        expenses: await count(`flats/${flatId}/expenses`),
        transfers: await count(`flats/${flatId}/transfers`),
        code: (await getDoc(doc(firestore, 'inviteCodes/ABC123'))).exists(),
        ownerEntry: (await getDoc(doc(firestore, `userFlats/${OWNER}/flats/${flatId}`))).exists(),
        housemateEntry: (
          await getDoc(doc(firestore, `userFlats/${Housemate}/flats/${flatId}`))
        ).exists(),
        counter: (await getDoc(doc(firestore, `owners/${OWNER}`))).data()?.flatCount,
      }
    })

  it('removes the flat, what it holds, the invite code and the memberships, and gives the slot back', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    await saveCompletion(db(OWNER), flatId, {
      weekIndex: 2,
      zone: 'Kitchen',
      memberId: owner,
      doneAt: '2026-10-27',
    })
    await saveExpense(db(Housemate), flatId, {
      kind: 'expense',
      title: 'Rice',
      amountCents: 300,
      paidBy: ben,
      participants: [owner, ben],
      date: '2026-10-20',
      createdBy: ben,
    })
    await leaveTransferTicket(db(Housemate), {
      flatId,
      memberId: ben,
      uid: Housemate,
      secret: makeSecret(),
    })

    await assertSucceeds(deleteFlat(googleDb(OWNER), removeInput(flatId)))

    expect(await left(flatId)).toEqual({
      flat: false,
      members: 0,
      users: 0,
      completions: 0,
      expenses: 0,
      transfers: 0,
      code: false,
      ownerEntry: false,
      // The entry of a flatmate is theirs: they remove it from the screen that says the home is gone
      housemateEntry: true,
      counter: 0,
    })
  })

  it('leaves nothing behind but the entry that is the flatmate own, which they can remove', async () => {
    const { flatId } = await flatWithBen()
    await deleteFlat(googleDb(OWNER), removeInput(flatId))

    // The flat cannot be opened any more, and the invite code does not find it
    await assertFails(
      new Promise<void>((resolve, reject) =>
        subscribeFlat(db(Housemate), flatId, () => resolve(), reject),
      ),
    )
    expect(await findFlatByCode(db(STRANGER), 'ABC123')).toBeNull()
    await assertSucceeds(forgetFlat(db(Housemate), Housemate, flatId))
    expect((await left(flatId)).housemateEntry).toBe(false)
  })

  it('gives back the slot: after deleting one of three, another can be created', async () => {
    await create('AAAAA1')
    await create('AAAAA2')
    const { flatId } = await create('AAAAA3')
    await expect(create('AAAAA4')).rejects.toThrow(FlatLimitError)

    await deleteFlat(googleDb(OWNER), removeInput(flatId, 'AAAAA3'))
    await assertSucceeds(create('AAAAA4'))
    await expect(create('AAAAA5')).rejects.toThrow(FlatLimitError)
  })

  it('is refused to a flatmate, and leaves the flat as it was', async () => {
    const { flatId } = await flatWithBen()
    await assertFails(deleteFlat(db(Housemate), { ...removeInput(flatId), uid: Housemate }))
    const after = await left(flatId)
    expect(after.flat).toBe(true)
    expect(after.members).toBe(3)
    expect(after.flat).toBe(true)
  })

  it('goes on after being cut half way: the people are gone and the owner runs it again', async () => {
    const { flatId, owner } = await flatWithBen()
    await saveCompletion(db(OWNER), flatId, {
      weekIndex: 2,
      zone: 'Kitchen',
      memberId: owner,
      doneAt: '2026-10-27',
    })
    // What the first attempt got done before it stopped: the mark and the other people
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore() as unknown as Firestore
      await updateDoc(doc(firestore, `flats/${flatId}`), { deleting: true })
      await deleteDoc(doc(firestore, `flats/${flatId}/users/${Housemate}`))
      await deleteDoc(doc(firestore, `flats/${flatId}/members/m1`))
      await deleteDoc(doc(firestore, `flats/${flatId}/members/m2`))
    })

    await assertSucceeds(deleteFlat(googleDb(OWNER), removeInput(flatId)))
    const after = await left(flatId)
    expect(after).toMatchObject({ flat: false, members: 0, users: 0, completions: 0, code: false })
  })

  it('deletes a flat with more documents than fit in one batch', async () => {
    const { flatId, owner, ben } = await flatWithBen()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore() as unknown as Firestore
      for (let start = 0; start < 900; start += 300) {
        const batch = writeBatch(firestore)
        for (let index = start; index < start + 300; index += 1) {
          batch.set(doc(firestore, `flats/${flatId}/completions/${index}_Kitchen`), {
            weekIndex: index,
            zone: 'Kitchen',
            memberId: index % 2 === 0 ? owner : ben,
            doneAt: '2026-10-27',
          })
        }
        await batch.commit()
      }
    })
    expect((await left(flatId)).completions).toBe(900)

    await assertSucceeds(deleteFlat(googleDb(OWNER), removeInput(flatId)))
    expect(await left(flatId)).toMatchObject({ flat: false, completions: 0 })
  })
})
