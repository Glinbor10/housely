import { readFileSync } from 'node:fs'
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
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const FLAT = 'flat1'
const OWNER = 'owner-uid'
const FLATMATE = 'flatmate-uid'
const STRANGER = 'stranger-uid'

const flatData = {
  name: 'My flat',
  startDate: '2026-10-12',
  zones: ['Kitchen', 'Bathroom'],
  inviteCode: 'ABC123',
  ownerUid: OWNER,
}

let env: RulesTestEnvironment

const db = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore()

// An identity with Google linked: what creating a flat requires. Anonymous identities have no
// Google entry in the identities claim of their token.
const googleDb = (uid: string) =>
  env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: 'google.com', identities: { 'google.com': [`g-${uid}`] } },
    })
    .firestore()

// Seeds a flat with an owner member and one unclaimed member, bypassing the rules.
const seedFlat = () =>
  env.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore()
    await setDoc(doc(firestore, `flats/${FLAT}`), flatData)
    await setDoc(doc(firestore, `flats/${FLAT}/members/m-owner`), {
      name: 'Ana',
      color: '#1976d2',
      uid: OWNER,
      active: true,
      order: 0,
    })
    await setDoc(doc(firestore, `flats/${FLAT}/members/m-free`), {
      name: 'Ben',
      color: '#388e3c',
      uid: null,
      active: true,
      order: 1,
    })
    await setDoc(doc(firestore, `flats/${FLAT}/users/${OWNER}`), { memberId: 'm-owner' })
    await setDoc(doc(firestore, 'inviteCodes/ABC123'), {
      flatId: FLAT,
      ownerUid: OWNER,
      flatName: 'My flat',
    })
  })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-housely',
    firestore: { rules: readFileSync('firebase/firestore/firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('flats', () => {
  it('lets a Google user create a flat with their own member and membership', async () => {
    const firestore = googleDb(OWNER)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, `flats/${FLAT}`), flatData)
    batch.set(doc(firestore, `flats/${FLAT}/members/m0`), {
      name: 'Ana',
      color: '#1976d2',
      uid: OWNER,
      active: true,
      order: 0,
    })
    batch.set(doc(firestore, `flats/${FLAT}/users/${OWNER}`), { memberId: 'm0' })
    batch.set(doc(firestore, 'inviteCodes/ABC123'), {
      flatId: FLAT,
      ownerUid: OWNER,
      flatName: 'My flat',
    })
    batch.set(doc(firestore, `owners/${OWNER}`), { flatCount: 1 })
    await assertSucceeds(batch.commit())
  })

  it('rejects creating a flat when unauthenticated', async () => {
    await assertFails(setDoc(doc(db(null), `flats/${FLAT}`), flatData))
  })

  it('rejects creating a flat owned by someone else', async () => {
    await assertFails(setDoc(doc(googleDb(STRANGER), `flats/${FLAT}`), flatData))
  })

  it('rejects an anonymous identity creating a flat, whatever else is right', async () => {
    const firestore = db(OWNER)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, `flats/${FLAT}`), flatData)
    batch.set(doc(firestore, `flats/${FLAT}/members/m0`), {
      name: 'Ana',
      color: '#1976d2',
      uid: OWNER,
      active: true,
      order: 0,
    })
    batch.set(doc(firestore, `flats/${FLAT}/users/${OWNER}`), { memberId: 'm0' })
    batch.set(doc(firestore, 'inviteCodes/ABC123'), {
      flatId: FLAT,
      ownerUid: OWNER,
      flatName: 'My flat',
    })
    batch.set(doc(firestore, `owners/${OWNER}`), { flatCount: 1 })
    await assertFails(batch.commit())
  })

  it('rejects a token that only claims to have signed in with Google', async () => {
    const liar = env
      .authenticatedContext(OWNER, { firebase: { sign_in_provider: 'google.com', identities: {} } })
      .firestore()
    await assertFails(setDoc(doc(liar, `flats/${FLAT}`), flatData))
  })

  it('rejects a flat with invalid data', async () => {
    const firestore = googleDb(OWNER)
    await assertFails(setDoc(doc(firestore, `flats/${FLAT}`), { ...flatData, name: '' }))
    await assertFails(setDoc(doc(firestore, `flats/${FLAT}`), { ...flatData, zones: [] }))
    await assertFails(setDoc(doc(firestore, `flats/${FLAT}`), { ...flatData, extra: true }))
  })

  it('lets members read the flat and blocks non-members and anonymous users', async () => {
    await seedFlat()
    await assertSucceeds(getDoc(doc(db(OWNER), `flats/${FLAT}`)))
    await assertFails(getDoc(doc(db(STRANGER), `flats/${FLAT}`)))
    await assertFails(getDoc(doc(db(null), `flats/${FLAT}`)))
  })

  it('blocks listing flats', async () => {
    await seedFlat()
    await assertFails(getDocs(collection(db(OWNER), 'flats')))
  })

  it('lets only the owner update the flat and keeps the owner immutable', async () => {
    await seedFlat()
    await assertSucceeds(updateDoc(doc(db(OWNER), `flats/${FLAT}`), { name: 'New name' }))
    await assertFails(updateDoc(doc(db(STRANGER), `flats/${FLAT}`), { name: 'Hacked' }))
    await assertFails(updateDoc(doc(db(OWNER), `flats/${FLAT}`), { ownerUid: STRANGER }))
  })

  it('never allows deleting a flat', async () => {
    await seedFlat()
    await assertFails(deleteDoc(doc(db(OWNER), `flats/${FLAT}`)))
  })
})

describe('abuse limits', () => {
  const ownerMember = (uid: string) => ({
    name: 'Ana',
    color: '#1976d2',
    uid,
    active: true,
    order: 0,
  })

  // Creates a whole flat in one batch; `counter` is what gets written to the owner counter document
  const createFlatBatch = (
    uid: string,
    flatId: string,
    code: string,
    counter: number,
    isUpdate: boolean,
  ) => {
    const firestore = googleDb(uid)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, `flats/${flatId}`), { ...flatData, ownerUid: uid, inviteCode: code })
    batch.set(doc(firestore, `flats/${flatId}/members/m0`), ownerMember(uid))
    batch.set(doc(firestore, `flats/${flatId}/users/${uid}`), { memberId: 'm0' })
    batch.set(doc(firestore, `inviteCodes/${code}`), { flatId, ownerUid: uid, flatName: 'My flat' })
    if (isUpdate) {
      batch.update(doc(firestore, `owners/${uid}`), { flatCount: counter })
    } else {
      batch.set(doc(firestore, `owners/${uid}`), { flatCount: counter })
    }
    return batch.commit()
  }

  it('lets an identity create up to 3 flats and no more', async () => {
    await assertSucceeds(createFlatBatch(OWNER, 'f1', 'AAAAA1', 1, false))
    await assertSucceeds(createFlatBatch(OWNER, 'f2', 'AAAAA2', 2, true))
    await assertSucceeds(createFlatBatch(OWNER, 'f3', 'AAAAA3', 3, true))
    await assertFails(createFlatBatch(OWNER, 'f4', 'AAAAA4', 4, true))
  })

  it('rejects a flat that does not move the counter by exactly one', async () => {
    await assertFails(createFlatBatch(OWNER, 'f1', 'BBBBB1', 0, false))
    await assertFails(createFlatBatch(OWNER, 'f1', 'BBBBB2', 2, false))
  })

  it('rejects creating a flat without touching the counter', async () => {
    const firestore = googleDb(OWNER)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, 'flats/f1'), flatData)
    batch.set(doc(firestore, 'flats/f1/members/m0'), ownerMember(OWNER))
    batch.set(doc(firestore, `flats/f1/users/${OWNER}`), { memberId: 'm0' })
    await assertFails(batch.commit())
  })

  it('keeps the counter private and never lets it go down', async () => {
    await assertSucceeds(createFlatBatch(OWNER, 'f1', 'CCCCC1', 1, false))
    await assertSucceeds(getDoc(doc(db(OWNER), `owners/${OWNER}`)))
    await assertFails(getDoc(doc(db(STRANGER), `owners/${OWNER}`)))
    await assertFails(updateDoc(doc(db(OWNER), `owners/${OWNER}`), { flatCount: 0 }))
    await assertFails(deleteDoc(doc(db(OWNER), `owners/${OWNER}`)))
  })

  it('allows at most 20 people per flat: ids are m0 to m19 and match the order', async () => {
    await seedFlat()
    const base = { name: 'P', color: '#f57c00', uid: null, active: true }
    const add = (id: string, order: number) =>
      setDoc(doc(db(OWNER), `flats/${FLAT}/members/${id}`), { ...base, order })
    await assertSucceeds(add('m19', 19))
    await assertFails(add('m20', 20))
    await assertFails(add('m7', 8))
    await assertFails(add('random-id', 5))
  })

  it('bounds the week of a completion', async () => {
    await seedFlat()
    const completion = (weekIndex: number) => ({
      weekIndex,
      zone: 'Kitchen',
      memberId: 'm-owner',
      doneAt: '2026-10-13',
    })
    await assertSucceeds(
      setDoc(doc(db(OWNER), `flats/${FLAT}/completions/1040_Kitchen`), completion(1040)),
    )
    await assertFails(
      setDoc(doc(db(OWNER), `flats/${FLAT}/completions/1041_Kitchen`), completion(1041)),
    )
  })
})

describe('finding your flats (userFlats)', () => {
  const entry = { memberId: 'm-free', flatName: 'My flat' }

  const join = async (uid: string) => {
    const firestore = db(uid)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), { uid })
    batch.set(doc(firestore, `flats/${FLAT}/users/${uid}`), { memberId: 'm-free' })
    batch.set(doc(firestore, `userFlats/${uid}/flats/${FLAT}`), entry)
    return batch.commit()
  }

  it('is written together with the membership when someone joins', async () => {
    await seedFlat()
    await assertSucceeds(join(FLATMATE))
    await assertSucceeds(getDoc(doc(db(FLATMATE), `userFlats/${FLATMATE}/flats/${FLAT}`)))
  })

  it('lets a person list only their own flats', async () => {
    await seedFlat()
    await assertSucceeds(join(FLATMATE))
    await assertSucceeds(getDocs(collection(db(FLATMATE), `userFlats/${FLATMATE}/flats`)))
    await assertFails(getDocs(collection(db(STRANGER), `userFlats/${FLATMATE}/flats`)))
    await assertFails(getDoc(doc(db(null), `userFlats/${FLATMATE}/flats/${FLAT}`)))
  })

  it('rejects an entry for another person or for a flat the person is not in', async () => {
    await seedFlat()
    await assertFails(setDoc(doc(db(STRANGER), `userFlats/${FLATMATE}/flats/${FLAT}`), entry))
    await assertFails(setDoc(doc(db(STRANGER), `userFlats/${STRANGER}/flats/${FLAT}`), entry))
  })

  it('rejects an entry that points to a member the person does not hold', async () => {
    await seedFlat()
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    batch.set(doc(firestore, `userFlats/${FLATMATE}/flats/${FLAT}`), {
      memberId: 'm-owner',
      flatName: 'My flat',
    })
    await assertFails(batch.commit())
  })

  it('lets a person forget a stale entry of their own', async () => {
    await seedFlat()
    await assertSucceeds(join(FLATMATE))
    await assertFails(deleteDoc(doc(db(STRANGER), `userFlats/${FLATMATE}/flats/${FLAT}`)))
    await assertSucceeds(deleteDoc(doc(db(FLATMATE), `userFlats/${FLATMATE}/flats/${FLAT}`)))
  })

  it('only accepts the expected fields', async () => {
    await seedFlat()
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    batch.set(doc(firestore, `userFlats/${FLATMATE}/flats/${FLAT}`), { ...entry, extra: true })
    await assertFails(batch.commit())
  })
})

describe('invite codes', () => {
  const create = (uid: string, flatName: string, extra: Record<string, unknown> = {}) => {
    const firestore = googleDb(uid)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, 'flats/f1'), { ...flatData, ownerUid: uid, inviteCode: 'DDDDD1' })
    batch.set(doc(firestore, 'flats/f1/members/m0'), {
      name: 'Ana',
      color: '#1976d2',
      uid,
      active: true,
      order: 0,
    })
    batch.set(doc(firestore, `flats/f1/users/${uid}`), { memberId: 'm0' })
    batch.set(doc(firestore, 'inviteCodes/DDDDD1'), {
      flatId: 'f1',
      ownerUid: uid,
      flatName,
      ...extra,
    })
    batch.set(doc(firestore, `owners/${uid}`), { flatCount: 1 })
    return batch.commit()
  }

  it('carries the name of the flat, so whoever joins sees which flat it is', async () => {
    await assertSucceeds(create(OWNER, 'My flat'))
    const code = await getDoc(doc(db(STRANGER), 'inviteCodes/DDDDD1'))
    expect(code.data()).toEqual({ flatId: 'f1', ownerUid: OWNER, flatName: 'My flat' })
  })

  it('must match the real name of the flat and be a short text', async () => {
    await assertFails(create(OWNER, 'Another name'))
    await assertFails(create(OWNER, ''))
  })

  it('accepts no other fields', async () => {
    await assertFails(create(OWNER, 'My flat', { extra: true }))
  })
})

describe('tricount link', () => {
  it('accepts https links on tricount.com and its subdomains', async () => {
    await seedFlat()
    const flat = doc(db(OWNER), `flats/${FLAT}`)
    await assertSucceeds(updateDoc(flat, { tricountUrl: 'https://tricount.com/tABC' }))
    await assertSucceeds(updateDoc(flat, { tricountUrl: 'https://app.tricount.com/tABC?x=1' }))
  })

  it('rejects other hosts, look-alike hosts and plain http', async () => {
    await seedFlat()
    const flat = doc(db(OWNER), `flats/${FLAT}`)
    await assertFails(updateDoc(flat, { tricountUrl: 'https://evil.com/tABC' }))
    await assertFails(updateDoc(flat, { tricountUrl: 'https://tricount.com.evil.com/x' }))
    await assertFails(updateDoc(flat, { tricountUrl: 'https://eviltricount.com/x' }))
    await assertFails(updateDoc(flat, { tricountUrl: 'http://tricount.com/x' }))
  })
})

describe('joining a flat', () => {
  it('lets a signed-in user claim an unclaimed member and create their membership', async () => {
    await seedFlat()
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    await assertSucceeds(batch.commit())
  })

  it('rejects claiming a member already claimed by someone else', async () => {
    await seedFlat()
    const firestore = db(STRANGER)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-owner`), { uid: STRANGER })
    batch.set(doc(firestore, `flats/${FLAT}/users/${STRANGER}`), { memberId: 'm-owner' })
    await assertFails(batch.commit())
  })

  it('rejects a membership without claiming a member', async () => {
    await seedFlat()
    await assertFails(
      setDoc(doc(db(STRANGER), `flats/${FLAT}/users/${STRANGER}`), { memberId: 'm-free' }),
    )
  })

  it('rejects creating a membership for another user', async () => {
    await seedFlat()
    const firestore = db(STRANGER)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: STRANGER })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    await assertFails(batch.commit())
  })

  it('lets a signed-in user read an invite code but not list them', async () => {
    await seedFlat()
    await assertSucceeds(getDoc(doc(db(STRANGER), 'inviteCodes/ABC123')))
    await assertFails(getDocs(collection(db(STRANGER), 'inviteCodes')))
    await assertFails(getDoc(doc(db(null), 'inviteCodes/ABC123')))
  })

  it('lets a signed-in user read the member names of the flat they are joining', async () => {
    await seedFlat()
    await assertSucceeds(getDocs(collection(db(STRANGER), `flats/${FLAT}/members`)))
    await assertFails(getDocs(collection(db(null), `flats/${FLAT}/members`)))
  })
})

describe('members', () => {
  it('lets the owner add members and blocks everybody else', async () => {
    await seedFlat()
    const member = { name: 'Carl', color: '#f57c00', uid: null, active: true, order: 2 }
    await assertSucceeds(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m2`), member))
    await assertFails(setDoc(doc(db(STRANGER), `flats/${FLAT}/members/m2`), member))
  })

  it('requires a non-negative integer order', async () => {
    await seedFlat()
    const base = { name: 'Carl', color: '#f57c00', uid: null, active: true }
    await assertFails(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m9`), base))
    await assertFails(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m-1`), { ...base, order: -1 }))
    await assertFails(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m1.5`), { ...base, order: 1.5 }))
    await assertSucceeds(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m3`), { ...base, order: 3 }))
  })

  it('never allows deleting members', async () => {
    await seedFlat()
    await assertFails(deleteDoc(doc(db(OWNER), `flats/${FLAT}/members/m-free`)))
  })

  it('lets the owner deactivate a member without reassigning its uid', async () => {
    await seedFlat()
    const member = doc(db(OWNER), `flats/${FLAT}/members/m-free`)
    await assertSucceeds(updateDoc(member, { active: false }))
    await assertFails(updateDoc(member, { uid: STRANGER }))
  })
})

describe('releasing a flatmate', () => {
  // Ben joined from a phone that was later lost; the owner frees the name.
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }

  const release = (uid: string, memberId: string, memberUid: string) => {
    const firestore = db(uid)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/${memberId}`), { uid: null })
    batch.delete(doc(firestore, `flats/${FLAT}/users/${memberUid}`))
    return batch.commit()
  }

  it('lets the owner free a claimed member and remove its membership', async () => {
    await seedBenJoined()
    await assertSucceeds(release(OWNER, 'm-free', FLATMATE))
    await assertFails(getDoc(doc(db(FLATMATE), `flats/${FLAT}`)))
  })

  it('lets the released person claim the name again from a new identity', async () => {
    await seedBenJoined()
    await assertSucceeds(release(OWNER, 'm-free', FLATMATE))
    const firestore = db('new-phone-uid')
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: 'new-phone-uid' })
    batch.set(doc(firestore, `flats/${FLAT}/users/new-phone-uid`), { memberId: 'm-free' })
    await assertSucceeds(batch.commit())
  })

  it('rejects anyone but the owner', async () => {
    await seedBenJoined()
    await assertFails(release(FLATMATE, 'm-owner', OWNER))
    await assertFails(release(STRANGER, 'm-free', FLATMATE))
  })

  it('never lets the owner release themselves', async () => {
    await seedBenJoined()
    await assertFails(release(OWNER, 'm-owner', OWNER))
  })

  it('does not let a member remove another membership without releasing the member', async () => {
    await seedBenJoined()
    await assertFails(deleteDoc(doc(db(OWNER), `flats/${FLAT}/users/${FLATMATE}`)))
  })

  it('keeps the completions made before the release', async () => {
    await seedBenJoined()
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `flats/${FLAT}/completions/0_Kitchen`), {
        weekIndex: 0,
        zone: 'Kitchen',
        memberId: 'm-free',
        doneAt: '2026-10-13',
      })
    })
    await assertSucceeds(release(OWNER, 'm-free', FLATMATE))
    await assertSucceeds(getDoc(doc(db(OWNER), `flats/${FLAT}/completions/0_Kitchen`)))
  })
})

describe('completions', () => {
  const completion = (memberId: string) => ({
    weekIndex: 3,
    zone: 'Kitchen',
    memberId,
    doneAt: '2026-10-30',
  })
  const path = `flats/${FLAT}/completions/3_Kitchen`

  it('lets a member register their own completion', async () => {
    await seedFlat()
    await assertSucceeds(setDoc(doc(db(OWNER), path), completion('m-owner')))
  })

  it('rejects a completion for another member', async () => {
    await seedFlat()
    await assertFails(setDoc(doc(db(OWNER), path), completion('m-free')))
  })

  it('rejects a non-member', async () => {
    await seedFlat()
    await assertFails(setDoc(doc(db(STRANGER), path), completion('m-owner')))
  })

  it('rejects an unknown zone, a bad date and an id that does not match week and zone', async () => {
    await seedFlat()
    const firestore = db(OWNER)
    await assertFails(
      setDoc(doc(firestore, `flats/${FLAT}/completions/3_Garage`), {
        ...completion('m-owner'),
        zone: 'Garage',
      }),
    )
    await assertFails(
      setDoc(doc(firestore, path), { ...completion('m-owner'), doneAt: 'yesterday' }),
    )
    await assertFails(
      setDoc(doc(firestore, `flats/${FLAT}/completions/other`), completion('m-owner')),
    )
  })

  it('lets members read completions and blocks non-members', async () => {
    await seedFlat()
    await assertSucceeds(setDoc(doc(db(OWNER), path), completion('m-owner')))
    await assertSucceeds(getDoc(doc(db(OWNER), path)))
    await assertFails(getDoc(doc(db(STRANGER), path)))
  })

  it('lets a member correct the date and delete only their own completion', async () => {
    await seedFlat()
    await assertSucceeds(setDoc(doc(db(OWNER), path), completion('m-owner')))
    await assertSucceeds(
      setDoc(doc(db(OWNER), path), { ...completion('m-owner'), doneAt: '2026-10-29' }),
    )
    await assertFails(deleteDoc(doc(db(STRANGER), path)))
    await assertSucceeds(deleteDoc(doc(db(OWNER), path)))
  })
})

describe('editing the rotation', () => {
  const layout = (overrides: Record<string, unknown> = {}) => ({
    fromWeek: 5,
    members: ['m-owner', 'm-free'],
    zones: ['Kitchen'],
    ...overrides,
  })
  const layoutPath = (id: string | number) => `flats/${FLAT}/layouts/${id}`

  // Ben joined, so he is a member of the flat but not its owner
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }

  it('lets the owner store a layout, and store it again to correct it', async () => {
    await seedFlat()
    const path = layoutPath(5)
    await assertSucceeds(setDoc(doc(db(OWNER), path), layout()))
    await assertSucceeds(setDoc(doc(db(OWNER), path), layout({ zones: ['Kitchen', 'Garden'] })))
  })

  it('does not let a flatmate or a stranger store one', async () => {
    await seedBenJoined()
    await assertFails(setDoc(doc(db(FLATMATE), layoutPath(5)), layout()))
    await assertFails(setDoc(doc(db(STRANGER), layoutPath(5)), layout()))
    await assertFails(setDoc(doc(db(null), layoutPath(5)), layout()))
  })

  it('lets members read the layouts and nobody else', async () => {
    await seedBenJoined()
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), layoutPath(5)), layout()),
    )
    await assertSucceeds(getDoc(doc(db(FLATMATE), layoutPath(5))))
    await assertSucceeds(getDoc(doc(db(OWNER), layoutPath(5))))
    await assertFails(getDoc(doc(db(STRANGER), layoutPath(5))))
    await assertFails(getDocs(collection(db(STRANGER), `flats/${FLAT}/layouts`)))
  })

  it('never deletes a layout: the history depends on them', async () => {
    await seedFlat()
    await setDoc(doc(db(OWNER), layoutPath(5)), layout())
    await assertFails(deleteDoc(doc(db(OWNER), layoutPath(5))))
  })

  it.each([
    ['an id that is not its week', layoutPath(6), layout()],
    ['a negative week', layoutPath(-1), layout({ fromWeek: -1 })],
    ['a week beyond the limit', layoutPath(1041), layout({ fromWeek: 1041 })],
    ['a week that is not an integer', layoutPath('5.5'), layout({ fromWeek: 5.5 })],
    ['nobody in the rotation', layoutPath(5), layout({ members: [] })],
    [
      'more than 20 people',
      layoutPath(5),
      layout({ members: Array.from({ length: 21 }, (_, i) => `m${i}`) }),
    ],
    ['no zones', layoutPath(5), layout({ zones: [] })],
    [
      'more than 20 zones',
      layoutPath(5),
      layout({ zones: Array.from({ length: 21 }, (_, i) => `z${i}`) }),
    ],
    ['an unknown field', layoutPath(5), layout({ admin: true })],
  ])('rejects %s', async (_label, path, data) => {
    await seedFlat()
    await assertFails(setDoc(doc(db(OWNER), path), data))
  })

  it('lets the owner rename or deactivate a flatmate who already joined', async () => {
    await seedBenJoined()
    const member = doc(db(OWNER), `flats/${FLAT}/members/m-free`)
    await assertSucceeds(updateDoc(member, { name: 'Benjamin' }))
    await assertSucceeds(updateDoc(member, { active: false }))
    // ...but still cannot hand their account to somebody else
    await assertFails(updateDoc(member, { uid: STRANGER }))
  })

  it('keeps the zones of this week usable until the new layout starts', async () => {
    await seedFlat()
    const flat = doc(db(OWNER), `flats/${FLAT}`)
    // The owner removes Kitchen (from next week) and remembers the zones in force now
    await assertSucceeds(
      updateDoc(flat, { zones: ['Bathroom', 'Garden'], previousZones: ['Kitchen', 'Bathroom'] }),
    )
    const completion = (zone: string) => ({
      weekIndex: 3,
      zone,
      memberId: 'm-owner',
      doneAt: '2026-10-30',
    })
    await assertSucceeds(
      setDoc(doc(db(OWNER), `flats/${FLAT}/completions/3_Kitchen`), completion('Kitchen')),
    )
    await assertSucceeds(
      setDoc(doc(db(OWNER), `flats/${FLAT}/completions/3_Garden`), completion('Garden')),
    )
    await assertFails(
      setDoc(doc(db(OWNER), `flats/${FLAT}/completions/3_Garage`), completion('Garage')),
    )
  })

  it('limits the remembered zones like the zones', async () => {
    await seedFlat()
    const flat = doc(db(OWNER), `flats/${FLAT}`)
    await assertFails(
      updateDoc(flat, { previousZones: Array.from({ length: 21 }, (_, i) => `z${i}`) }),
    )
    await assertFails(updateDoc(flat, { previousZones: 'Kitchen' }))
  })
})
