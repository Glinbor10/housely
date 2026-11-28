/**
 * Seed the Firebase Auth + Firestore emulators with demo data to try every screen of Housely.
 *
 * Usage:
 *   npm run dev:seed      starts the emulators, loads this data and opens the app (what the launch uses)
 *   npm run seed          loads it again while `npm run dev` is running (it clears the emulators first)
 *
 * Everything is relative to today, so the weeks, the history and the expenses are always up to date.
 *
 * People (sign in with Google in the app and pick one in the emulator popup):
 *   guille@demo.com  owner of two flats, member of a third one
 *   carla@demo.com   member of "Piso Calle Mayor" (has Google linked)
 *   marta@demo.com   owner of "Piso grande"
 * Ben and Pablo joined without Google (anonymous): they have no popup account, but they show in the lists.
 *
 * Flats:
 *   Piso Calle Mayor  3 people, 3 zones, 5 weeks of history: own and other debts, a zone not at the flat,
 *                     a zone made up with a cleaning of a flatmate, a week in progress, 8 expenses and a
 *                     payment, the Tricount link. Ben has no Google (cannot be made owner), Carla has.
 *   Casa de la playa  2 people, 5 zones: a person has 3 zones next week ("+1" in the week). Lucía has not
 *                     joined: join with the code PLAYA1 to try the joining of a flat.
 *   Piso grande       5 people, 3 zones: two people rest each week. Marta is the owner and Guille a plain
 *                     member (no owner tools). The expenses close in 5 days (banner). Sofía and Dani have
 *                     not joined: join with the code GRANDE.
 */

const PROJECT = 'demo-housely'
const AUTH_BASE = 'http://localhost:9099'
const FS_ADMIN = `http://localhost:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`
const FS_BASE = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`

/** Wait until both emulators respond, retrying every 500 ms up to maxWaitMs. */
const waitForEmulators = async (maxWaitMs = 60000) => {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    try {
      const [a, f] = await Promise.all([
        fetch(`${AUTH_BASE}/emulator/v1/projects/${PROJECT}/config`),
        fetch(`http://localhost:8080/`),
      ])
      if (a.ok && f.ok) return
    } catch {
      // not up yet: keep waiting
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Emulators did not respond within 60 s. Is `npm run dev` running?')
}

// --- Firestore REST helpers ---------------------------------------------------

const sv = (v) => ({ stringValue: v })
const bv = (v) => ({ booleanValue: v })
const iv = (v) => ({ integerValue: String(v) })
const av = (items) => ({ arrayValue: { values: items } })
const mv = (fields) => ({ mapValue: { fields } })
const nv = () => ({ nullValue: 'NULL_VALUE' })
const tv = (date = new Date()) => ({ timestampValue: date.toISOString() })

/** PATCH (create or replace) a Firestore document at the given path segments. */
const setDoc = async (pathSegments, fields) => {
  const path = pathSegments.join('/')
  const response = await fetch(`${FS_BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(`PATCH ${path} -> ${response.status}: ${await response.text()}`)
}

// --- Auth emulator helpers ----------------------------------------------------

const batchCreate = async (users) => {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchCreate?key=emulator`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ users }),
    },
  )
  if (!response.ok) throw new Error(`batchCreate -> ${response.status}: ${await response.text()}`)
}

/** People with Google linked: they show in the popup of the emulator. */
const createGoogleUsers = (users) =>
  batchCreate(
    users.map(({ uid, email, name }) => ({
      localId: uid,
      email,
      displayName: name,
      emailVerified: true,
      providerUserInfo: [
        { providerId: 'google.com', rawId: `google-${uid}`, email, displayName: name },
      ],
    })),
  )

/** People who joined with the invite code only (anonymous). */
const createAnonymousUsers = (uids) => batchCreate(uids.map((localId) => ({ localId })))

const clearEmulators = async () => {
  const auth = await fetch(`${AUTH_BASE}/emulator/v1/projects/${PROJECT}/accounts`, {
    method: 'DELETE',
  })
  if (!auth.ok && auth.status !== 404) throw new Error(`Clear auth -> ${auth.status}`)
  const fs = await fetch(FS_ADMIN, { method: 'DELETE' })
  if (!fs.ok && fs.status !== 404) throw new Error(`Clear firestore -> ${fs.status}`)
}

// --- dates, relative to today -------------------------------------------------

const pad = (n) => String(n).padStart(2, '0')
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  return toIso(new Date(y, m - 1, d + days))
}
const today = toIso(new Date())
const daysAgo = (n) => addDays(today, -n)
// The week of the rotation starts on the day the flat started
const weekStart = (start, week) => addDays(start, week * 7)
const currentWeek = (start) => {
  const [y, m, d] = start.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000)
  return Math.floor(days / 7)
}

// --- the data model, one function per kind of document ------------------------

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#d32f2f', '#0097a7']

/**
 * A flat with its people. `members` are in rotation order: m0, m1, ... A person with a `uid` has joined;
 * `google` says whether they have Google linked.
 */
const seedFlat = async ({
  id,
  code,
  name,
  startDate,
  zones,
  members,
  ownerIndex,
  tricountUrl,
  nextCloseDate,
  lastClosedAt,
}) => {
  const owner = members[ownerIndex]
  await setDoc(['flats', id], {
    name: sv(name),
    startDate: sv(startDate),
    zones: av(zones.map(sv)),
    inviteCode: sv(code),
    ownerUid: sv(owner.uid),
    createdAt: tv(),
    ...(tricountUrl ? { tricountUrl: sv(tricountUrl) } : {}),
    periodClose: mv({
      nextCloseDate: sv(nextCloseDate),
      intervalMonths: iv(6),
      ...(lastClosedAt ? { lastClosedAt: sv(lastClosedAt) } : {}),
    }),
  })
  for (const [index, member] of members.entries()) {
    await setDoc(['flats', id, 'members', `m${index}`], {
      name: sv(member.name),
      color: sv(COLORS[index % COLORS.length]),
      uid: member.uid ? sv(member.uid) : nv(),
      active: bv(true),
      order: iv(index),
      ...(member.uid && member.google ? { hasGoogle: bv(true) } : {}),
    })
    if (member.uid) {
      await setDoc(['flats', id, 'users', member.uid], { memberId: sv(`m${index}`) })
      await setDoc(['userFlats', member.uid, 'flats', id], {
        memberId: sv(`m${index}`),
        flatName: sv(name),
      })
    }
  }
  await setDoc(['inviteCodes', code], {
    flatId: sv(id),
    ownerUid: sv(owner.uid),
    flatName: sv(name),
  })
}

const completion = (flat, weekIndex, zone, memberId, doneAt) =>
  setDoc(['flats', flat, 'completions', `${weekIndex}_${zone}`], {
    weekIndex: iv(weekIndex),
    zone: sv(zone),
    memberId: sv(memberId),
    doneAt: sv(doneAt),
  })

const settlement = (flat, s) =>
  setDoc(['flats', flat, 'settlements', `${s.weekIndex}_${s.zone}`], {
    weekIndex: iv(s.weekIndex),
    zone: sv(s.zone),
    kind: sv(s.kind),
    memberId: sv(s.memberId),
    ...(s.note ? { note: sv(s.note) } : {}),
    ...(s.tookWeek !== undefined ? { tookWeek: iv(s.tookWeek), tookZone: sv(s.tookZone) } : {}),
    settledAt: tv(),
  })

const takeover = (flat, t) =>
  setDoc(['flats', flat, 'takeovers', `${t.weekIndex}_${t.zone}`], {
    weekIndex: iv(t.weekIndex),
    zone: sv(t.zone),
    takerId: sv(t.takerId),
    fromId: sv(t.fromId),
    debtWeek: iv(t.debtWeek),
    debtZone: sv(t.debtZone),
    takenAt: tv(),
  })

let expenseCount = 0
const expense = (flat, e) =>
  setDoc(['flats', flat, 'expenses', `exp-${String(++expenseCount).padStart(3, '0')}`], {
    kind: sv(e.kind ?? 'expense'),
    title: sv(e.title),
    amountCents: iv(e.cents),
    paidBy: sv(e.paidBy),
    participants: av(e.who.map(sv)),
    date: sv(e.date),
    createdBy: sv(e.paidBy),
    createdAt: tv(),
  })

/** Who has a zone of a week with the plain rotation: members[(week + zoneIndex) % members.length]. */
const ownerOf = (members, week, zoneIndex) => `m${(week + zoneIndex) % members.length}`

/** The day a zone was done: a few days into its week, a different one for each. */
const doneDay = (start, week, zoneIndex) =>
  addDays(weekStart(start, week), 1 + ((week + zoneIndex) % 5))

// --- main ---------------------------------------------------------------------

console.log('Waiting for the emulators...')
await waitForEmulators()
console.log('Clearing the emulators...')
await clearEmulators()

const GUILLE = 'uid-demo-guille'
const CARLA = 'uid-demo-carla'
const MARTA = 'uid-demo-marta'
const BEN = 'uid-demo-ben'
const PABLO = 'uid-demo-pablo'

console.log('Creating people...')
await createGoogleUsers([
  { uid: GUILLE, email: 'guille@demo.com', name: 'Guille' },
  { uid: CARLA, email: 'carla@demo.com', name: 'Carla' },
  { uid: MARTA, email: 'marta@demo.com', name: 'Marta' },
])
await createAnonymousUsers([BEN, PABLO])
// Guille owns two flats: he can still create one more (the limit is three per person)
await setDoc(['owners', GUILLE], { flatCount: iv(2) })
await setDoc(['owners', MARTA], { flatCount: iv(1) })

// ---- Piso Calle Mayor ----------------------------------------------------------
console.log('Creating "Piso Calle Mayor"...')
{
  const id = 'flat-calle-mayor'
  // It started 37 days ago, on a day that is not a Monday on purpose: the weeks count from that day
  const start = daysAgo(37)
  const members = [
    { name: 'Guille', uid: GUILLE, google: true },
    { name: 'Ben', uid: BEN, google: false },
    { name: 'Carla', uid: CARLA, google: true },
  ]
  const zones = ['Salón', 'Cocina', 'Baño']
  await seedFlat({
    id,
    code: 'CALLE1',
    name: 'Piso Calle Mayor',
    startDate: start,
    zones,
    members,
    ownerIndex: 0,
    tricountUrl: 'https://tricount.com/tdemo-calle-mayor',
    nextCloseDate: addDays(today, 150),
  })

  const weeks = currentWeek(start)
  // What happened in each finished week and zone: done unless it is in these lists
  const missed = new Set(['1_1', '2_1', '3_0', '3_2', '4_0']) // `${week}_${zoneIndex}`
  const away = new Set(['2_2'])
  for (let week = 0; week < weeks; week += 1) {
    for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
      const key = `${week}_${zoneIndex}`
      if (missed.has(key) || away.has(key)) continue
      await completion(
        id,
        week,
        zones[zoneIndex],
        ownerOf(members, week, zoneIndex),
        doneDay(start, week, zoneIndex),
      )
    }
  }
  // Ben was not at the flat in week 2 (his bathroom)
  await settlement(id, {
    weekIndex: 2,
    zone: 'Baño',
    kind: 'away',
    memberId: 'm1',
    note: 'De viaje en Lisboa',
  })
  // Carla made up her kitchen of week 1 by taking Ben's bathroom of the running week
  await takeover(id, {
    weekIndex: weeks,
    zone: 'Baño',
    takerId: 'm2',
    fromId: ownerOf(members, weeks, 2),
    debtWeek: 1,
    debtZone: 'Cocina',
  })
  await settlement(id, {
    weekIndex: 1,
    zone: 'Cocina',
    kind: 'madeUp',
    memberId: 'm2',
    tookWeek: weeks,
    tookZone: 'Baño',
  })
  // The running week: the living room is already done by Carla
  await completion(id, weeks, 'Salón', ownerOf(members, weeks, 0), daysAgo(1))

  const all = ['m0', 'm1', 'm2']
  const list = [
    ['Compra del súper', 5430, 'm0', all, 2],
    ['Luz de octubre', 7890, 'm1', all, 6],
    ['Internet', 3500, 'm2', all, 9],
    ['Pizzas del viernes', 2400, 'm0', ['m0', 'm1'], 12],
    ['Productos de limpieza', 1875, 'm2', all, 15],
    ['Cafetera nueva', 4990, 'm1', all, 20],
    ['Agua del trimestre', 6215, 'm0', all, 26],
    ['Bombillas del pasillo', 1260, 'm2', ['m0', 'm2'], 31],
  ]
  for (const [title, cents, paidBy, who, ago] of list) {
    await expense(id, { title, cents, paidBy, who, date: daysAgo(ago) })
  }
  // Ben gave Guille part of what he owes
  await expense(id, {
    kind: 'payment',
    title: 'Pago',
    cents: 2000,
    paidBy: 'm1',
    who: ['m0'],
    date: daysAgo(1),
  })
}

// ---- Casa de la playa ----------------------------------------------------------
console.log('Creating "Casa de la playa"...')
{
  const id = 'flat-playa'
  const start = daysAgo(10)
  const members = [
    { name: 'Guille', uid: GUILLE, google: true },
    { name: 'Lucía', uid: null },
  ]
  const zones = ['Salón', 'Cocina', 'Baño', 'Terraza', 'Pasillo']
  await seedFlat({
    id,
    code: 'PLAYA1',
    name: 'Casa de la playa',
    startDate: start,
    zones,
    members,
    ownerIndex: 0,
    nextCloseDate: addDays(today, 170),
  })
  // Week 0: Lucía's zones and one of Guille's were not cleaned
  for (const [zoneIndex, zone] of zones.entries()) {
    if (zoneIndex === 1 || zoneIndex === 4) continue
    await completion(id, 0, zone, ownerOf(members, 0, zoneIndex), doneDay(start, 0, zoneIndex))
  }
  await expense(id, {
    title: 'Alquiler de sombrillas',
    cents: 4000,
    paidBy: 'm0',
    who: ['m0', 'm1'],
    date: daysAgo(3),
  })
  await expense(id, {
    title: 'Compra de la playa',
    cents: 2350,
    paidBy: 'm0',
    who: ['m0', 'm1'],
    date: daysAgo(5),
  })
}

// ---- Piso grande ---------------------------------------------------------------
console.log('Creating "Piso grande"...')
{
  const id = 'flat-grande'
  const start = daysAgo(24)
  const members = [
    { name: 'Marta', uid: MARTA, google: true },
    { name: 'Guille', uid: GUILLE, google: true },
    { name: 'Pablo', uid: PABLO, google: false },
    { name: 'Sofía', uid: null },
    { name: 'Dani', uid: null },
  ]
  const zones = ['Salón', 'Cocina', 'Baño']
  await seedFlat({
    id,
    code: 'GRANDE',
    name: 'Piso grande',
    startDate: start,
    zones,
    members,
    ownerIndex: 0,
    // Closes in 5 days: the banner of the expenses shows
    nextCloseDate: addDays(today, 5),
    lastClosedAt: addDays(today, -176),
  })
  const weeks = currentWeek(start)
  const missed = new Set(['1_2', '2_1', '2_2']) // Sofía and Dani, who have not joined
  for (let week = 0; week < weeks; week += 1) {
    for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
      if (missed.has(`${week}_${zoneIndex}`)) continue
      await completion(
        id,
        week,
        zones[zoneIndex],
        ownerOf(members, week, zoneIndex),
        doneDay(start, week, zoneIndex),
      )
    }
  }
  const all = ['m0', 'm1', 'm2', 'm3', 'm4']
  await expense(id, { title: 'Internet', cents: 4500, paidBy: 'm0', who: all, date: daysAgo(4) })
  await expense(id, {
    title: 'Fregona y cubo',
    cents: 1850,
    paidBy: 'm1',
    who: all,
    date: daysAgo(8),
  })
  await expense(id, {
    title: 'Cena de bienvenida',
    cents: 9600,
    paidBy: 'm2',
    who: ['m0', 'm1', 'm2'],
    date: daysAgo(14),
  })
}

console.log(`
Seed complete.

Sign in with Google in the app and pick one of these people in the popup:
  guille@demo.com   owner of "Piso Calle Mayor" and "Casa de la playa", member of "Piso grande"
  carla@demo.com    member of "Piso Calle Mayor" (took a zone from Ben, has Google)
  marta@demo.com    owner of "Piso grande"

Join with a code (press "Join a flat"):
  PLAYA1  Casa de la playa: join as Lucía
  GRANDE  Piso grande: join as Sofía or Dani
  CALLE1  Piso Calle Mayor: every person has joined (try the error of a taken name)

Things to look at:
  - Week:     Guille has the kitchen (pending); the next week he has the living room. In "Casa de la playa"
              he has 3 zones next week ("+1"). Carla has a zone taken from Ben (chip and week it makes up).
  - History:  debts of his own (Settle) and of others, a zone "not at the flat", a zone made up, the calendar
              with weeks that start on the day the flat started (not on Monday).
  - Expenses: 9 rows ("Show more"), who owes whom, a payment, the Tricount link; "Piso grande" has the banner.
  - People:   the menu of Ben (no Google: cannot be made owner) and Carla (can); the Google chips.
`)
