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
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

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
    await setDoc(doc(firestore, 'inviteCodes/ABC123'), { flatId: FLAT, ownerUid: OWNER })
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
  it('lets a signed-in user create a flat with their own member and membership', async () => {
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
    batch.set(doc(firestore, 'inviteCodes/ABC123'), { flatId: FLAT, ownerUid: OWNER })
    batch.set(doc(firestore, `owners/${OWNER}`), { flatCount: 1 })
    await assertSucceeds(batch.commit())
  })

  it('rejects creating a flat when unauthenticated', async () => {
    await assertFails(setDoc(doc(db(null), `flats/${FLAT}`), flatData))
  })

  it('rejects creating a flat owned by someone else', async () => {
    await assertFails(setDoc(doc(db(STRANGER), `flats/${FLAT}`), flatData))
  })

  it('rejects a flat with invalid data', async () => {
    const firestore = db(OWNER)
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
    const firestore = db(uid)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, `flats/${flatId}`), { ...flatData, ownerUid: uid, inviteCode: code })
    batch.set(doc(firestore, `flats/${flatId}/members/m0`), ownerMember(uid))
    batch.set(doc(firestore, `flats/${flatId}/users/${uid}`), { memberId: 'm0' })
    batch.set(doc(firestore, `inviteCodes/${code}`), { flatId, ownerUid: uid })
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
    const firestore = db(OWNER)
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
