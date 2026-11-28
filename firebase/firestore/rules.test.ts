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
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PERSON_COLORS } from '../../src/domain/palette'

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

  it('keeps the counter private and only lets it go down when a flat is deleted', async () => {
    await assertSucceeds(createFlatBatch(OWNER, 'f1', 'CCCCC1', 1, false))
    await assertSucceeds(getDoc(doc(db(OWNER), `owners/${OWNER}`)))
    await assertFails(getDoc(doc(db(STRANGER), `owners/${OWNER}`)))
    await assertFails(updateDoc(doc(db(OWNER), `owners/${OWNER}`), { flatCount: 0 }))
    await assertFails(deleteDoc(doc(db(OWNER), `owners/${OWNER}`)))
  })

  it('creates a flat of 20 people in one batch, within the 20 access calls that Firestore allows a batched write', async () => {
    // Each member is written with a getAfter on the flat. Firestore caps a batched write at 20 access calls,
    // and the repeated calls on the same document are cached: this keeps the biggest flat from being denied.
    const owner = googleDb(OWNER)
    const batch = writeBatch(owner)
    batch.set(doc(owner, 'flats/big'), { ...flatData, inviteCode: 'BIG123' })
    for (let order = 0; order < 20; order++) {
      batch.set(doc(owner, `flats/big/members/m${order}`), {
        name: `Person ${order}`,
        color: '#1976d2',
        uid: order === 0 ? OWNER : null,
        active: true,
        order,
        ...(order === 0 ? { hasGoogle: true } : {}),
      })
    }
    batch.set(doc(owner, `flats/big/users/${OWNER}`), { memberId: 'm0' })
    batch.set(doc(owner, 'inviteCodes/BIG123'), {
      flatId: 'big',
      ownerUid: OWNER,
      flatName: 'My flat',
    })
    batch.set(doc(owner, `owners/${OWNER}`), { flatCount: 1 })
    await assertSucceeds(batch.commit())
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

  it('lets the joiner choose a color from the palette while claiming the member', async () => {
    await seedFlat()
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), {
      uid: FLATMATE,
      color: '#c2185b',
    })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    await assertSucceeds(batch.commit())
  })

  it('rejects a color outside the palette while claiming a member', async () => {
    await seedFlat()
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), {
      uid: FLATMATE,
      color: '#123456',
    })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    await assertFails(batch.commit())
  })

  it('rejects changing anything else but the uid and the color while claiming a member', async () => {
    await seedFlat()
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, `flats/${FLAT}/members/m-free`), {
      uid: FLATMATE,
      color: '#c2185b',
      name: 'Renamed',
    })
    batch.set(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    await assertFails(batch.commit())
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

  it('does not let a flatmate undo a cleaning that somebody else marked as done', async () => {
    await seedFlat()
    // Ben joined, so he is a member of the flat
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await setDoc(doc(firestore, `flats/${FLAT}/members/m-free`), {
        name: 'Ben',
        color: '#388e3c',
        uid: FLATMATE,
        active: true,
        order: 1,
      })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
    await assertSucceeds(setDoc(doc(db(OWNER), path), completion('m-owner')))
    await assertFails(deleteDoc(doc(db(FLATMATE), path)))
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

describe('the color of each person', () => {
  // Ben joined: he is a member of the flat, not its owner
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }
  const ben = () => doc(db(FLATMATE), `flats/${FLAT}/members/m-free`)
  const ana = () => doc(db(FLATMATE), `flats/${FLAT}/members/m-owner`)

  it('lets a person pick their own color from the palette', async () => {
    await seedBenJoined()
    await assertSucceeds(updateDoc(ben(), { color: '#c2185b' }))
  })

  it('rejects a color that is not in the palette', async () => {
    await seedBenJoined()
    await assertFails(updateDoc(ben(), { color: '#123456' }))
    await assertFails(updateDoc(ben(), { color: 'red' }))
  })

  it('does not let a person change the color of somebody else', async () => {
    await seedBenJoined()
    await assertFails(updateDoc(ana(), { color: '#c2185b' }))
  })

  it('does not let a person change anything else together with their color', async () => {
    await seedBenJoined()
    await assertFails(updateDoc(ben(), { color: '#c2185b', name: 'Benjamin' }))
    await assertFails(updateDoc(ben(), { color: '#c2185b', active: false }))
    await assertFails(updateDoc(ben(), { color: '#c2185b', uid: null }))
  })

  it('does not let a stranger change any color', async () => {
    await seedBenJoined()
    await assertFails(
      updateDoc(doc(db(STRANGER), `flats/${FLAT}/members/m-free`), { color: '#c2185b' }),
    )
  })

  it('lets the owner set the color of anyone', async () => {
    await seedBenJoined()
    await assertSucceeds(
      updateDoc(doc(db(OWNER), `flats/${FLAT}/members/m-free`), { color: '#9e9d24' }),
    )
  })

  it('does not accept a new person with a color outside the palette', async () => {
    await seedFlat()
    const base = { name: 'Carl', uid: null, active: true, order: 2 }
    await assertFails(
      setDoc(doc(db(OWNER), `flats/${FLAT}/members/m2`), { ...base, color: '#123456' }),
    )
    await assertSucceeds(
      setDoc(doc(db(OWNER), `flats/${FLAT}/members/m2`), { ...base, color: '#f57c00' }),
    )
  })

  it('has in the rules the same palette as the app, so a color can never be accepted by one and not the other', () => {
    const rules = readFileSync('firebase/firestore/firestore.rules', 'utf8')
    const listed = /data\.color in \[([^\]]*)\]/.exec(rules)?.[1] ?? ''
    const colors = [...listed.matchAll(/'(#[0-9a-f]{6})'/g)].map((match) => match[1])
    expect(colors).toEqual(PERSON_COLORS.map((color) => color.hex))
  })
})

describe('renaming the flat and handing it over', () => {
  // Ben joined, so he is a member of the flat but not its owner
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }
  const flatOf = (uid: string) => doc(db(uid), `flats/${FLAT}`)
  const codeOf = (uid: string) => doc(db(uid), 'inviteCodes/ABC123')

  describe('renaming', () => {
    it('lets the owner rename the flat and its invite code together', async () => {
      await seedFlat()
      const firestore = db(OWNER)
      const batch = writeBatch(firestore)
      batch.update(doc(firestore, `flats/${FLAT}`), { name: 'Calle Luna 12' })
      batch.update(doc(firestore, 'inviteCodes/ABC123'), { flatName: 'Calle Luna 12' })
      await assertSucceeds(batch.commit())
    })

    it('only accepts the name of the invite code when it is the name of the flat', async () => {
      await seedFlat()
      await assertFails(updateDoc(codeOf(OWNER), { flatName: 'Something else' }))
      const firestore = db(OWNER)
      const batch = writeBatch(firestore)
      batch.update(doc(firestore, `flats/${FLAT}`), { name: 'Calle Luna 12' })
      batch.update(doc(firestore, 'inviteCodes/ABC123'), { flatName: 'Another name' })
      await assertFails(batch.commit())
    })

    it('does not let anybody but the owner rename the flat or its invite code', async () => {
      await seedBenJoined()
      for (const uid of [FLATMATE, STRANGER]) {
        const firestore = db(uid)
        const batch = writeBatch(firestore)
        batch.update(doc(firestore, `flats/${FLAT}`), { name: 'Mine now' })
        batch.update(doc(firestore, 'inviteCodes/ABC123'), { flatName: 'Mine now' })
        await assertFails(batch.commit())
      }
      await assertFails(updateDoc(codeOf(null as unknown as string), { flatName: 'x' }))
    })

    it('never lets the invite code point to another flat', async () => {
      await seedFlat()
      await assertFails(updateDoc(codeOf(OWNER), { flatId: 'other-flat' }))
    })

    it('rejects an empty name and a name that is too long', async () => {
      await seedFlat()
      await assertFails(updateDoc(flatOf(OWNER), { name: '' }))
      await assertFails(updateDoc(flatOf(OWNER), { name: 'x'.repeat(61) }))
    })

    it('never lets the start of the rotation change: every week would move and the history with it', async () => {
      await seedFlat()
      await assertFails(updateDoc(flatOf(OWNER), { startDate: '2026-01-05' }))
    })

    it('lets people keep the name of the flat in their own list, and nobody else touch it', async () => {
      await seedBenJoined()
      await env.withSecurityRulesDisabled((context) =>
        setDoc(doc(context.firestore(), `userFlats/${FLATMATE}/flats/${FLAT}`), {
          memberId: 'm-free',
          flatName: 'My flat',
        }),
      )
      const mine = doc(db(FLATMATE), `userFlats/${FLATMATE}/flats/${FLAT}`)
      await assertSucceeds(setDoc(mine, { memberId: 'm-free', flatName: 'Calle Luna 12' }))
      await assertFails(
        setDoc(doc(db(OWNER), `userFlats/${FLATMATE}/flats/${FLAT}`), {
          memberId: 'm-free',
          flatName: 'x',
        }),
      )
    })
  })

  describe('handing the flat over', () => {
    const handOver = (uid: string, to: string, codeOwner = to) => {
      const firestore = db(uid)
      const batch = writeBatch(firestore)
      batch.update(doc(firestore, `flats/${FLAT}`), { ownerUid: to })
      batch.update(doc(firestore, 'inviteCodes/ABC123'), { ownerUid: codeOwner })
      return batch.commit()
    }

    // Ben joined and has Google linked, which the rules ask of the next owner
    const seedBenWithGoogle = async () => {
      await seedBenJoined()
      await env.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), `flats/${FLAT}/members/m-free`), {
          hasGoogle: true,
        })
      })
    }

    it('lets the owner hand the flat to a member who has joined with Google, with the invite code', async () => {
      await seedBenWithGoogle()
      await assertSucceeds(handOver(OWNER, FLATMATE))
    })

    it('does not hand the flat to a member who has not linked Google', async () => {
      await seedBenJoined()
      await assertFails(handOver(OWNER, FLATMATE))
    })

    it('makes the new owner the owner and takes the powers from the old one', async () => {
      await seedBenWithGoogle()
      await handOver(OWNER, FLATMATE)
      await assertSucceeds(updateDoc(flatOf(FLATMATE), { name: 'Ben is in charge' }))
      await assertFails(updateDoc(flatOf(OWNER), { name: 'Back to Ana' }))
      // The old owner stays in the flat as a member
      await assertSucceeds(getDoc(flatOf(OWNER)))
    })

    it('does not hand the flat to somebody who is not a member', async () => {
      await seedBenJoined()
      await assertFails(handOver(OWNER, STRANGER))
    })

    it('does not let a flatmate take the flat for themselves', async () => {
      await seedBenJoined()
      await assertFails(updateDoc(flatOf(FLATMATE), { ownerUid: FLATMATE }))
    })

    it('hands over only the ownership: nothing else can change in the same update', async () => {
      await seedBenJoined()
      await assertFails(updateDoc(flatOf(OWNER), { ownerUid: FLATMATE, name: 'Hijacked' }))
      await assertFails(updateDoc(flatOf(OWNER), { ownerUid: FLATMATE, zones: ['Garage'] }))
    })

    it('keeps the owner of the invite code equal to the owner of the flat', async () => {
      await seedBenJoined()
      await assertFails(handOver(OWNER, FLATMATE, STRANGER))
      await assertFails(updateDoc(codeOf(OWNER), { ownerUid: STRANGER }))
    })
  })
})

describe('settling a zone that nobody cleaned', () => {
  // The flat starts on Monday 2026-10-12: week 0 and 1 are finished, the running one is computed
  const weekMillis = 7 * 24 * 60 * 60 * 1000
  const runningWeek = Math.floor((Date.now() - Date.UTC(2026, 9, 12)) / weekMillis)

  // Ben joined, so he is a member who is not the owner
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }
  const settlement = (overrides: Record<string, unknown> = {}) => ({
    weekIndex: 0,
    zone: 'Kitchen',
    kind: 'away',
    memberId: 'm-free',
    settledAt: serverTimestamp(),
    ...overrides,
  })
  const path = (weekIndex: number, zone: string) => `flats/${FLAT}/settlements/${weekIndex}_${zone}`
  const asBen = (weekIndex = 0, zone = 'Kitchen') => doc(db(FLATMATE), path(weekIndex, zone))

  it('lets any member forgive a zone of a finished week, with a note everybody can read', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(asBen(), settlement({ note: 'He was away' })))
    await assertSucceeds(getDoc(doc(db(OWNER), path(0, 'Kitchen'))))
  })

  it('needs the date of the cleaning when it was done late, and a real one', async () => {
    await seedBenJoined()
    await assertFails(setDoc(asBen(), settlement({ kind: 'late' })))
    await assertFails(setDoc(asBen(), settlement({ kind: 'late', doneAt: '22/10/2026' })))
    await assertSucceeds(setDoc(asBen(), settlement({ kind: 'late', doneAt: '2026-10-22' })))
  })

  it('needs somebody who is in the flat to cover it', async () => {
    await seedBenJoined()
    await assertFails(setDoc(asBen(), settlement({ kind: 'covered' })))
    await assertFails(setDoc(asBen(), settlement({ kind: 'covered', coveredBy: 'm-nobody' })))
    await assertSucceeds(setDoc(asBen(), settlement({ kind: 'covered', coveredBy: 'm-owner' })))
  })

  it('does not accept a cover or a date that does not belong to the way it was settled', async () => {
    await seedBenJoined()
    await assertFails(setDoc(asBen(), settlement({ kind: 'away', coveredBy: 'm-owner' })))
    await assertFails(setDoc(asBen(), settlement({ kind: 'away', doneAt: 'yesterday' })))
  })

  it('only settles weeks that are over, never the running one or a future one', async () => {
    await seedBenJoined()
    await assertFails(setDoc(asBen(runningWeek), settlement({ weekIndex: runningWeek })))
    await assertFails(setDoc(asBen(runningWeek + 3), settlement({ weekIndex: runningWeek + 3 })))
    await assertSucceeds(setDoc(asBen(runningWeek - 1), settlement({ weekIndex: runningWeek - 1 })))
  })

  it('never settles a zone that was done: a cleaning is not rewritten', async () => {
    await seedBenJoined()
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), `flats/${FLAT}/completions/0_Kitchen`), {
        weekIndex: 0,
        zone: 'Kitchen',
        memberId: 'm-owner',
        doneAt: '2026-10-14',
      }),
    )
    await assertFails(setDoc(asBen(), settlement()))
  })

  it('does not let a person settle in the name of somebody else, or with another time', async () => {
    await seedBenJoined()
    await assertFails(setDoc(asBen(), settlement({ memberId: 'm-owner' })))
    await assertFails(setDoc(asBen(), settlement({ settledAt: new Date('2020-01-01') })))
  })

  it('does not let a stranger or somebody signed out settle or read', async () => {
    await seedBenJoined()
    await assertFails(setDoc(doc(db(STRANGER), path(0, 'Kitchen')), settlement()))
    await assertFails(setDoc(doc(db(null), path(0, 'Kitchen')), settlement()))
    await assertSucceeds(setDoc(asBen(), settlement()))
    await assertFails(getDoc(doc(db(STRANGER), path(0, 'Kitchen'))))
  })

  it.each([
    [
      'an identifier that is not its week and zone',
      () => asBen(0, 'Bathroom'),
      { zone: 'Kitchen' },
    ],
    ['a note that is too long', () => asBen(), { note: 'x'.repeat(141) }],
    ['a way of settling that does not exist', () => asBen(), { kind: 'ignored' }],
    ['an unknown field', () => asBen(), { admin: true }],
    ['a zone with a slash', () => asBen(0, 'A'), { zone: 'A/B' }],
    ['a week beyond the limit', () => asBen(2000), { weekIndex: 2000 }],
  ])('rejects %s', async (_label, reference, overrides) => {
    await seedBenJoined()
    await assertFails(setDoc(reference(), settlement(overrides)))
  })

  it('accepts a zone that is not in the flat any more: it may have been renamed since that week', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(asBen(0, 'Old zone'), settlement({ zone: 'Old zone' })))
  })

  it('lets the author or the owner undo it, and nobody else', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(asBen(), settlement()))
    // Somebody else who joined cannot touch it
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await setDoc(doc(firestore, `flats/${FLAT}/members/m-three`), {
        name: 'Carl',
        color: '#f57c00',
        uid: 'carl-uid',
        active: true,
        order: 2,
      })
      await setDoc(doc(firestore, `flats/${FLAT}/users/carl-uid`), { memberId: 'm-three' })
    })
    await assertFails(deleteDoc(doc(db('carl-uid'), path(0, 'Kitchen'))))
    await assertSucceeds(deleteDoc(asBen()))

    await assertSucceeds(setDoc(asBen(), settlement()))
    await assertSucceeds(deleteDoc(doc(db(OWNER), path(0, 'Kitchen'))))
  })

  it('lets the author change how it was settled, but not who settled it or when', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(asBen(), settlement()))
    await assertSucceeds(updateDoc(asBen(), { kind: 'late', doneAt: '2026-10-22' }))
    await assertFails(updateDoc(asBen(), { memberId: 'm-owner' }))
    await assertFails(updateDoc(asBen(), { settledAt: new Date('2020-01-01') }))
    // Taking away the date of a cleaning that was done late leaves it incomplete
    await assertFails(updateDoc(asBen(), { doneAt: deleteField() }))
  })
})

describe('making up a zone with another cleaning', () => {
  const weekMillis = 7 * 24 * 60 * 60 * 1000
  const runningWeek = Math.floor((Date.now() - Date.UTC(2026, 9, 12)) / weekMillis)

  // Ben joined, so he is a member who is not the owner
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }
  const takeover = (overrides: Record<string, unknown> = {}) => ({
    weekIndex: runningWeek,
    zone: 'Kitchen',
    takerId: 'm-free',
    fromId: 'm-owner',
    debtWeek: 0,
    debtZone: 'Bathroom',
    takenAt: serverTimestamp(),
    ...overrides,
  })
  const debt = (overrides: Record<string, unknown> = {}) => ({
    weekIndex: 0,
    zone: 'Bathroom',
    kind: 'madeUp',
    memberId: 'm-free',
    tookWeek: runningWeek,
    tookZone: 'Kitchen',
    settledAt: serverTimestamp(),
    ...overrides,
  })
  const takeoverPath = (weekIndex: number, zone: string) =>
    `flats/${FLAT}/takeovers/${weekIndex}_${zone}`
  const settlementPath = (weekIndex: number, zone: string) =>
    `flats/${FLAT}/settlements/${weekIndex}_${zone}`

  // Both documents go together: the debt that is settled and the cleaning that settles it
  const take = (
    uid: string,
    takeoverData: Record<string, unknown>,
    debtData: Record<string, unknown>,
  ) => {
    const firestore = db(uid)
    const batch = writeBatch(firestore)
    batch.set(
      doc(firestore, takeoverPath(takeoverData.weekIndex as number, takeoverData.zone as string)),
      takeoverData,
    )
    batch.set(
      doc(firestore, settlementPath(debtData.weekIndex as number, debtData.zone as string)),
      debtData,
    )
    return batch.commit()
  }

  it('lets a member take a zone of this week that is not done, to settle a finished week', async () => {
    await seedBenJoined()
    await assertSucceeds(take(FLATMATE, takeover(), debt()))
    await assertSucceeds(getDoc(doc(db(OWNER), takeoverPath(runningWeek, 'Kitchen'))))
  })

  it('lets a member take a zone of a future week', async () => {
    await seedBenJoined()
    await assertSucceeds(
      take(FLATMATE, takeover({ weekIndex: runningWeek + 2 }), debt({ tookWeek: runningWeek + 2 })),
    )
  })

  it('does not let a zone of a finished week be taken', async () => {
    await seedBenJoined()
    await assertFails(
      take(
        FLATMATE,
        takeover({ weekIndex: runningWeek - 1, debtWeek: 0 }),
        debt({ tookWeek: runningWeek - 1 }),
      ),
    )
  })

  it('does not let a zone that is done be taken', async () => {
    await seedBenJoined()
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `flats/${FLAT}/completions/${runningWeek}_Kitchen`), {
        weekIndex: runningWeek,
        zone: 'Kitchen',
        memberId: 'm-owner',
        doneAt: '2026-10-29',
      })
    })
    await assertFails(take(FLATMATE, takeover(), debt()))
  })

  it('does not let a person take a zone in the name of somebody else', async () => {
    await seedBenJoined()
    await assertFails(
      take(
        FLATMATE,
        takeover({ takerId: 'm-owner', fromId: 'm-free' }),
        debt({ memberId: 'm-owner' }),
      ),
    )
  })

  it('does not accept the cleaning without the settlement of the debt, nor the other way around', async () => {
    await seedBenJoined()
    await assertFails(setDoc(doc(db(FLATMATE), takeoverPath(runningWeek, 'Kitchen')), takeover()))
    await assertFails(setDoc(doc(db(FLATMATE), settlementPath(0, 'Bathroom')), debt()))
  })

  it('does not accept a settlement that points to a different cleaning than the one taken', async () => {
    await seedBenJoined()
    await assertFails(take(FLATMATE, takeover(), debt({ tookZone: 'Bathroom' })))
  })

  it('does not let a taken zone be taken again', async () => {
    await seedBenJoined()
    await assertSucceeds(take(FLATMATE, takeover(), debt()))
    await assertFails(take(FLATMATE, takeover({ debtZone: 'Kitchen' }), debt({ zone: 'Kitchen' })))
  })

  it('lets the person undo it, both documents together, while the cleaning is not done', async () => {
    await seedBenJoined()
    await assertSucceeds(take(FLATMATE, takeover(), debt()))
    const firestore = db(FLATMATE)
    const batch = writeBatch(firestore)
    batch.delete(doc(firestore, takeoverPath(runningWeek, 'Kitchen')))
    batch.delete(doc(firestore, settlementPath(0, 'Bathroom')))
    await assertSucceeds(batch.commit())
  })

  it('does not let somebody else undo it', async () => {
    await seedBenJoined()
    await assertSucceeds(take(FLATMATE, takeover(), debt()))
    await assertFails(deleteDoc(doc(db(OWNER), takeoverPath(runningWeek, 'Kitchen'))))
  })

  it('never changes a taken zone afterwards', async () => {
    await seedBenJoined()
    await assertSucceeds(take(FLATMATE, takeover(), debt()))
    await assertFails(
      updateDoc(doc(db(FLATMATE), takeoverPath(runningWeek, 'Kitchen')), { takerId: 'm-owner' }),
    )
    await assertFails(updateDoc(doc(db(FLATMATE), settlementPath(0, 'Bathroom')), { kind: 'away' }))
  })
})

describe('expenses', () => {
  // Ben joined, so he is a member who is not the owner
  const seedBenJoined = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await updateDoc(doc(firestore, `flats/${FLAT}/members/m-free`), { uid: FLATMATE })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-free' })
    })
  }
  const expense = (overrides: Record<string, unknown> = {}) => ({
    kind: 'expense',
    title: 'Cleaning products',
    amountCents: 1250,
    paidBy: 'm-owner',
    participants: ['m-owner', 'm-free'],
    date: '2026-10-20',
    createdBy: 'm-owner',
    createdAt: serverTimestamp(),
    ...overrides,
  })
  const path = (id: string) => `flats/${FLAT}/expenses/${id}`

  it('lets a member write an expense in their own name, and everybody in the flat read it', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(doc(db(OWNER), path('e1')), expense()))
    await assertSucceeds(getDoc(doc(db(FLATMATE), path('e1'))))
    await assertFails(getDoc(doc(db(STRANGER), path('e1'))))
  })

  it('does not let a member write an expense in the name of somebody else', async () => {
    await seedBenJoined()
    await assertFails(setDoc(doc(db(FLATMATE), path('e1')), expense({ createdBy: 'm-owner' })))
    await assertFails(setDoc(doc(db(STRANGER), path('e1')), expense()))
  })

  it('needs the amount to be a positive whole number of cents that is not too big', async () => {
    await seedBenJoined()
    const owner = db(OWNER)
    await assertFails(setDoc(doc(owner, path('e1')), expense({ amountCents: 0 })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ amountCents: -5 })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ amountCents: 12.5 })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ amountCents: 10_000_001 })))
    await assertSucceeds(setDoc(doc(owner, path('e1')), expense({ amountCents: 10_000_000 })))
  })

  it('needs a title, a real date, somebody in the flat who paid and people to split it between', async () => {
    await seedBenJoined()
    const owner = db(OWNER)
    await assertFails(setDoc(doc(owner, path('e1')), expense({ title: '' })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ title: 'x'.repeat(61) })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ date: '20/10/2026' })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ paidBy: 'nobody' })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ participants: [] })))
    await assertFails(setDoc(doc(owner, path('e1')), expense({ kind: 'gift' })))
  })

  it('makes a payment go from one person to exactly one other', async () => {
    await seedBenJoined()
    const owner = db(OWNER)
    const payment = { kind: 'payment', paidBy: 'm-owner', participants: ['m-free'] }
    await assertSucceeds(setDoc(doc(owner, path('p1')), expense(payment)))
    await assertFails(
      setDoc(doc(owner, path('p2')), expense({ ...payment, participants: ['m-owner'] })),
    )
    await assertFails(
      setDoc(doc(owner, path('p3')), expense({ ...payment, participants: ['m-free', 'm-owner'] })),
    )
  })

  it('lets only the person who wrote it change it, without changing who wrote it', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(doc(db(OWNER), path('e1')), expense()))
    await assertSucceeds(updateDoc(doc(db(OWNER), path('e1')), { title: 'Soap', amountCents: 900 }))
    await assertFails(updateDoc(doc(db(FLATMATE), path('e1')), { title: 'Mine now' }))
    await assertFails(updateDoc(doc(db(OWNER), path('e1')), { createdBy: 'm-free' }))
    await assertFails(updateDoc(doc(db(OWNER), path('e1')), { kind: 'payment' }))
  })

  it('lets only the person who wrote it delete it', async () => {
    await seedBenJoined()
    await assertSucceeds(setDoc(doc(db(OWNER), path('e1')), expense()))
    await assertFails(deleteDoc(doc(db(FLATMATE), path('e1'))))
    await assertFails(deleteDoc(doc(db(STRANGER), path('e1'))))
    await assertSucceeds(deleteDoc(doc(db(OWNER), path('e1'))))
  })
})

describe('deleting a flat for good', () => {
  // A flat with a bit of everything: the owner and a flatmate, their data, a ticket and the counter
  const seedFull = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await setDoc(doc(firestore, `flats/${FLAT}/members/m-ben`), {
        name: 'Carl',
        color: '#f57c00',
        uid: FLATMATE,
        active: true,
        order: 2,
      })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${FLATMATE}`), { memberId: 'm-ben' })
      await setDoc(doc(firestore, `flats/${FLAT}/completions/0_Kitchen`), {
        weekIndex: 0,
        zone: 'Kitchen',
        memberId: 'm-ben',
        doneAt: '2026-10-13',
      })
      await setDoc(doc(firestore, `flats/${FLAT}/expenses/e1`), {
        kind: 'expense',
        title: 'Rice',
        amountCents: 100,
        paidBy: 'm-ben',
        participants: ['m-ben'],
        date: '2026-10-13',
        createdBy: 'm-ben',
        createdAt: Timestamp.now(),
      })
      await setDoc(doc(firestore, `flats/${FLAT}/settlements/0_Bathroom`), {
        weekIndex: 0,
        zone: 'Bathroom',
        kind: 'away',
        memberId: 'm-ben',
        settledAt: Timestamp.now(),
      })
      await setDoc(doc(firestore, `flats/${FLAT}/takeovers/9_Kitchen`), { takerId: 'm-ben' })
      await setDoc(doc(firestore, `flats/${FLAT}/layouts/0`), {
        fromWeek: 0,
        members: ['Ana', 'Carl'],
        zones: ['Kitchen'],
      })
      await setDoc(doc(firestore, `flats/${FLAT}/transfers/m-ben`), {
        fromUid: FLATMATE,
        secret: 'f'.repeat(32),
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.now(),
      })
      await setDoc(doc(firestore, `owners/${OWNER}`), { flatCount: 2 })
      await setDoc(doc(firestore, `userFlats/${OWNER}/flats/${FLAT}`), {
        memberId: 'm-owner',
        flatName: 'My flat',
      })
    })
  }

  // What the owner does first: marks the flat as being deleted
  const markDeleting = () =>
    env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), `flats/${FLAT}`), { deleting: true }),
    )

  // The last step: the flat, the invite code, the owner's own traces and the counter, together
  const finalBatch = (uid = OWNER, freed = FLAT, flatCount = 1) => {
    const firestore = db(uid)
    const batch = writeBatch(firestore)
    batch.delete(doc(firestore, `flats/${FLAT}/users/${uid}`))
    batch.delete(doc(firestore, `flats/${FLAT}`))
    batch.delete(doc(firestore, 'inviteCodes/ABC123'))
    batch.delete(doc(firestore, `userFlats/${uid}/flats/${FLAT}`))
    batch.set(doc(firestore, `owners/${uid}`), { flatCount, freed })
    return batch.commit()
  }

  describe('the mark', () => {
    const flatPath = `flats/${FLAT}`

    it('is set by the owner, on the flat itself', async () => {
      await seedFull()
      await assertSucceeds(updateDoc(doc(db(OWNER), flatPath), { deleting: true }))
    })

    it('is refused to anybody who is not the owner', async () => {
      await seedFull()
      await assertFails(updateDoc(doc(db(FLATMATE), flatPath), { deleting: true }))
      await assertFails(updateDoc(doc(db(STRANGER), flatPath), { deleting: true }))
      await assertFails(updateDoc(doc(db(null), flatPath), { deleting: true }))
    })

    it('only means one thing: it is true or it is not there', async () => {
      await seedFull()
      await assertFails(updateDoc(doc(db(OWNER), flatPath), { deleting: false }))
      await assertFails(updateDoc(doc(db(OWNER), flatPath), { deleting: 'yes' }))
    })

    it('cannot be set by somebody else overwriting the flat', async () => {
      await seedFull()
      await assertFails(setDoc(doc(db(STRANGER), flatPath), { ...flatData, deleting: true }))
    })
  })

  describe('removing what the flat holds', () => {
    const paths = [
      `flats/${FLAT}/completions/0_Kitchen`,
      `flats/${FLAT}/expenses/e1`,
      `flats/${FLAT}/settlements/0_Bathroom`,
      `flats/${FLAT}/takeovers/9_Kitchen`,
      `flats/${FLAT}/layouts/0`,
      `flats/${FLAT}/transfers/m-ben`,
      `flats/${FLAT}/members/m-ben`,
      `flats/${FLAT}/users/${FLATMATE}`,
    ]

    it('lets the owner remove all of it, even what other people wrote, once the flat is marked', async () => {
      await seedFull()
      await markDeleting()
      for (const path of paths) {
        await assertSucceeds(deleteDoc(doc(db(OWNER), path)))
      }
    })

    it('lets nobody remove it without the mark, not even the owner (who already undoes settlements)', async () => {
      await seedFull()
      for (const path of paths.filter(
        (path) => !path.includes('/transfers/') && !path.includes('/settlements/'),
      )) {
        await assertFails(deleteDoc(doc(db(OWNER), path)))
      }
      await assertFails(deleteDoc(doc(db(OWNER), `flats/${FLAT}`)))
    })

    it('never lets a flatmate or a stranger remove what others wrote, marked or not', async () => {
      await seedFull()
      await markDeleting()
      await assertFails(deleteDoc(doc(db(FLATMATE), `flats/${FLAT}/layouts/0`)))
      await assertFails(deleteDoc(doc(db(FLATMATE), `flats/${FLAT}/members/m-owner`)))
      await assertFails(deleteDoc(doc(db(FLATMATE), `flats/${FLAT}/users/${OWNER}`)))
      await assertFails(deleteDoc(doc(db(STRANGER), `flats/${FLAT}/expenses/e1`)))
      await assertFails(deleteDoc(doc(db(STRANGER), `flats/${FLAT}/members/m-ben`)))
      await assertFails(deleteDoc(doc(db(FLATMATE), `flats/${FLAT}`)))
    })

    it('does not let a stranger mark a flat that is not theirs to remove its data', async () => {
      await seedFull()
      await assertFails(updateDoc(doc(db(STRANGER), `flats/${FLAT}`), { deleting: true }))
      await assertFails(deleteDoc(doc(db(STRANGER), `flats/${FLAT}/layouts/0`)))
    })
  })

  describe('the last step', () => {
    it('removes the flat, the invite code and the owner traces, and gives the slot back', async () => {
      await seedFull()
      await markDeleting()
      await assertSucceeds(finalBatch())
      await env.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore()
        expect((await getDoc(doc(firestore, `flats/${FLAT}`))).exists()).toBe(false)
        expect((await getDoc(doc(firestore, 'inviteCodes/ABC123'))).exists()).toBe(false)
        expect((await getDoc(doc(firestore, `owners/${OWNER}`))).data()?.flatCount).toBe(1)
      })
    })

    it('is refused without the mark', async () => {
      await seedFull()
      await assertFails(finalBatch())
    })

    it('is refused to a flatmate', async () => {
      await seedFull()
      await markDeleting()
      await assertFails(finalBatch(FLATMATE))
    })

    it('does not give a slot back without the flat going away in the same batch', async () => {
      await seedFull()
      await markDeleting()
      await assertFails(setDoc(doc(db(OWNER), `owners/${OWNER}`), { flatCount: 1, freed: FLAT }))
    })

    it('does not give back two slots for one flat', async () => {
      await seedFull()
      await markDeleting()
      await assertFails(finalBatch(OWNER, FLAT, 0))
    })

    it('cannot lower the counter for a flat that is not the one deleted, or that is not yours', async () => {
      await seedFull()
      await markDeleting()
      await env.withSecurityRulesDisabled((context) =>
        setDoc(doc(context.firestore(), 'flats/other'), { ...flatData, ownerUid: STRANGER }),
      )
      const firestore = db(OWNER)
      const batch = writeBatch(firestore)
      batch.delete(doc(firestore, `flats/${FLAT}`))
      batch.set(doc(firestore, `owners/${OWNER}`), { flatCount: 1, freed: 'other' })
      await assertFails(batch.commit())
    })

    it('cannot be replayed once the flat is gone', async () => {
      await seedFull()
      await markDeleting()
      await assertSucceeds(finalBatch())
      await assertFails(setDoc(doc(db(OWNER), `owners/${OWNER}`), { flatCount: 0, freed: FLAT }))
    })

    it('does not remove an invite code on its own', async () => {
      await seedFull()
      await markDeleting()
      await assertFails(deleteDoc(doc(db(OWNER), 'inviteCodes/ABC123')))
      await assertFails(deleteDoc(doc(db(FLATMATE), 'inviteCodes/ABC123')))
    })
  })
})

describe('moving a member to a Google account (transfer ticket)', () => {
  const OLD = 'old-anonymous-uid'
  const NEW = 'google-account-uid'
  const SECRET = '0123456789abcdef0123456789abcdef'
  const ticketPath = `flats/${FLAT}/transfers/m-ben`

  // Ben joined without Google: his member is held by the anonymous identity OLD
  const seedWithBen = async () => {
    await seedFlat()
    await env.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore()
      await setDoc(doc(firestore, `flats/${FLAT}/members/m-ben`), {
        name: 'Ben',
        color: '#388e3c',
        uid: OLD,
        active: true,
        order: 2,
      })
      await setDoc(doc(firestore, `flats/${FLAT}/users/${OLD}`), { memberId: 'm-ben' })
    })
  }

  const ticket = (overrides: Record<string, unknown> = {}) => ({
    fromUid: OLD,
    secret: SECRET,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 8 * 60 * 1000),
    ...overrides,
  })

  // The ticket as it would be stored, written without the rules
  const seedTicket = (extra: Record<string, unknown> = {}, expiresInMs = 10 * 60 * 1000) =>
    env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), ticketPath), {
        fromUid: OLD,
        secret: SECRET,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
        ...extra,
      }),
    )

  const claim = (firestore: ReturnType<typeof googleDb>, uid: string, proof = SECRET) => {
    const batch = writeBatch(firestore)
    batch.update(doc(firestore, ticketPath), { claimedBy: uid, proof })
    batch.update(doc(firestore, `flats/${FLAT}/members/m-ben`), { uid, hasGoogle: true })
    batch.set(doc(firestore, `flats/${FLAT}/users/${uid}`), { memberId: 'm-ben' })
    batch.delete(doc(firestore, `flats/${FLAT}/users/${OLD}`))
    batch.set(doc(firestore, `userFlats/${uid}/flats/${FLAT}`), {
      memberId: 'm-ben',
      flatName: 'My flat',
    })
    return batch.commit()
  }

  describe('leaving the ticket', () => {
    it('lets the holder of the member leave it, and nobody read it', async () => {
      await seedWithBen()
      await assertSucceeds(setDoc(doc(db(OLD), ticketPath), ticket()))
      await assertFails(getDoc(doc(db(OLD), ticketPath)))
      await assertFails(getDoc(doc(googleDb(NEW), ticketPath)))
    })

    it('rejects a ticket from somebody who does not hold the member', async () => {
      await seedWithBen()
      await assertFails(setDoc(doc(db(FLATMATE), ticketPath), ticket({ fromUid: FLATMATE })))
      await assertFails(setDoc(doc(db(STRANGER), ticketPath), ticket({ fromUid: STRANGER })))
    })

    it('rejects a ticket that lasts longer than ten minutes, or has a short secret', async () => {
      await seedWithBen()
      const tooLong = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000)
      await assertFails(setDoc(doc(db(OLD), ticketPath), ticket({ expiresAt: tooLong })))
      await assertFails(setDoc(doc(db(OLD), ticketPath), ticket({ secret: 'short' })))
    })

    it('never lets the owner leave one: the owner already has Google', async () => {
      await seedWithBen()
      await assertFails(
        setDoc(doc(googleDb(OWNER), `flats/${FLAT}/transfers/m-owner`), ticket({ fromUid: OWNER })),
      )
    })
  })

  describe('claiming it', () => {
    it('moves the member, the membership and the entry of the flats to the Google account', async () => {
      await seedWithBen()
      await seedTicket()
      await assertSucceeds(claim(googleDb(NEW), NEW))
      await env.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore()
        const member = (await getDoc(doc(firestore, `flats/${FLAT}/members/m-ben`))).data()
        expect(member?.uid).toBe(NEW)
        expect(member?.hasGoogle).toBe(true)
        expect((await getDoc(doc(firestore, `flats/${FLAT}/users/${OLD}`))).exists()).toBe(false)
        expect((await getDoc(doc(firestore, `flats/${FLAT}/users/${NEW}`))).exists()).toBe(true)
      })
    })

    it('lets the account that claimed it delete the ticket afterwards, and nobody else', async () => {
      await seedWithBen()
      await seedTicket()
      await assertSucceeds(claim(googleDb(NEW), NEW))
      await assertFails(deleteDoc(doc(db(FLATMATE), ticketPath)))
      await assertSucceeds(deleteDoc(doc(googleDb(NEW), ticketPath)))
    })

    it('rejects a wrong secret', async () => {
      await seedWithBen()
      await seedTicket()
      await assertFails(claim(googleDb(NEW), NEW, 'f'.repeat(32)))
    })

    it('rejects an expired ticket', async () => {
      await seedWithBen()
      await seedTicket({}, -1000)
      await assertFails(claim(googleDb(NEW), NEW))
    })

    it('rejects an identity without Google', async () => {
      await seedWithBen()
      await seedTicket()
      await assertFails(claim(db(NEW) as ReturnType<typeof googleDb>, NEW))
    })

    it('rejects using a ticket twice', async () => {
      await seedWithBen()
      await seedTicket()
      await assertSucceeds(claim(googleDb(NEW), NEW))
      await assertFails(claim(googleDb('another-google-uid'), 'another-google-uid'))
    })

    it('rejects a Google account that already is in the flat as another member', async () => {
      await seedWithBen()
      await seedTicket()
      await env.withSecurityRulesDisabled((context) =>
        setDoc(doc(context.firestore(), `flats/${FLAT}/users/${NEW}`), { memberId: 'm-free' }),
      )
      await assertFails(claim(googleDb(NEW), NEW))
    })

    it('rejects moving the member without claiming the ticket', async () => {
      await seedWithBen()
      await seedTicket()
      const firestore = googleDb(NEW)
      const batch = writeBatch(firestore)
      batch.update(doc(firestore, `flats/${FLAT}/members/m-ben`), { uid: NEW, hasGoogle: true })
      batch.set(doc(firestore, `flats/${FLAT}/users/${NEW}`), { memberId: 'm-ben' })
      batch.delete(doc(firestore, `flats/${FLAT}/users/${OLD}`))
      await assertFails(batch.commit())
    })

    it('rejects changing anything else of the member while claiming', async () => {
      await seedWithBen()
      await seedTicket()
      const firestore = googleDb(NEW)
      const batch = writeBatch(firestore)
      batch.update(doc(firestore, ticketPath), { claimedBy: NEW, proof: SECRET })
      batch.update(doc(firestore, `flats/${FLAT}/members/m-ben`), {
        uid: NEW,
        hasGoogle: true,
        name: 'Somebody else',
      })
      batch.set(doc(firestore, `flats/${FLAT}/users/${NEW}`), { memberId: 'm-ben' })
      batch.delete(doc(firestore, `flats/${FLAT}/users/${OLD}`))
      await assertFails(batch.commit())
    })
  })
})
