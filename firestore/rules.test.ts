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
    firestore: { rules: readFileSync('firestore/firestore.rules', 'utf8') },
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
    batch.set(doc(firestore, `flats/${FLAT}/members/m-owner`), {
      name: 'Ana',
      color: '#1976d2',
      uid: OWNER,
      active: true,
      order: 0,
    })
    batch.set(doc(firestore, `flats/${FLAT}/users/${OWNER}`), { memberId: 'm-owner' })
    batch.set(doc(firestore, 'inviteCodes/ABC123'), { flatId: FLAT, ownerUid: OWNER })
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
    await assertSucceeds(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m-new`), member))
    await assertFails(setDoc(doc(db(STRANGER), `flats/${FLAT}/members/m-new2`), member))
  })

  it('requires a non-negative integer order', async () => {
    await seedFlat()
    const base = { name: 'Carl', color: '#f57c00', uid: null, active: true }
    await assertFails(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m-a`), base))
    await assertFails(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m-b`), { ...base, order: -1 }))
    await assertFails(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m-c`), { ...base, order: 1.5 }))
    await assertSucceeds(setDoc(doc(db(OWNER), `flats/${FLAT}/members/m-d`), { ...base, order: 3 }))
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
