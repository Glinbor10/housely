// The copy of the data against the real emulator of Firestore: the command line runs as a person would
// run it, and the database must come back exactly as it was. Run it with `npm run test:rules`.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Firestore, GeoPoint, Timestamp } from '@google-cloud/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { dumpDatabase } from '../../scripts/backup/dump.mjs'

const PROJECT = 'demo-housely'
const PASSPHRASE = 'a long passphrase for the tests'
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
process.env.FIRESTORE_EMULATOR_HOST = HOST

const db = new Firestore({ projectId: PROJECT })
const folder = mkdtempSync(join(tmpdir(), 'housely-backup-'))

const run = (args, env = {}) => {
  const result = spawnSync(process.execPath, ['scripts/backup/cli.mjs', ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: HOST,
      BACKUP_PASSPHRASE: PASSPHRASE,
      GOOGLE_APPLICATION_CREDENTIALS: '',
      ...env,
    },
  })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

const clearDatabase = () =>
  fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  })

const seed = async () => {
  await db.doc('flats/f1').set({
    name: 'My flat',
    startDate: '2026-10-12',
    zones: ['Kitchen', 'Bathroom'],
    ownerUid: 'owner-uid',
    createdAt: Timestamp.fromMillis(1_760_000_000_123),
    periodClose: { nextCloseDate: '2027-05-13', intervalMonths: 6 },
  })
  await db.doc('flats/f1/members/m0').set({
    name: 'Ana',
    color: '#1976d2',
    uid: 'owner-uid',
    active: true,
    order: 0,
    hasGoogle: true,
  })
  await db.doc('flats/f1/members/m1').set({
    name: 'Ben',
    color: '#388e3c',
    uid: null,
    active: true,
    order: 1,
  })
  await db.doc('flats/f1/expenses/e1').set({
    kind: 'expense',
    title: 'Groceries',
    amountCents: 3050,
    paidBy: 'm0',
    participants: ['m0', 'm1'],
    date: '2026-11-12',
  })
  await db.doc('flats/f1/completions/2_Kitchen').set({
    weekIndex: 2,
    zone: 'Kitchen',
    memberId: 'm0',
    doneAt: '2026-10-14',
  })
  await db
    .doc('inviteCodes/ABC123')
    .set({ flatId: 'f1', ownerUid: 'owner-uid', flatName: 'My flat' })
  await db.doc('userFlats/owner-uid/flats/f1').set({ memberId: 'm0', flatName: 'My flat' })
  await db.doc('owners/owner-uid').set({ flatCount: 1 })
  // Types that the app does not use today, but that a copy must keep
  await db.doc('misc/types').set({
    place: new GeoPoint(40.4, -3.7),
    bytes: Buffer.from([1, 2, 3]),
    reference: db.doc('flats/f1'),
    nothing: null,
    ratio: 0.5,
  })
}

const DOCUMENTS = 9
const snapshot = async () => (await dumpDatabase(db)).documents
const copyFiles = () => readdirSync(folder).filter((name) => name.endsWith('.hsbk'))

beforeEach(async () => {
  await clearDatabase()
  for (const name of readdirSync(folder)) rmSync(join(folder, name))
})

afterAll(async () => {
  await clearDatabase()
  rmSync(folder, { recursive: true, force: true })
})

describe('copy and restore of Firestore, with the real command line', () => {
  it('copies the database, checks the copy, and brings it back exactly as it was', async () => {
    await seed()
    const before = await snapshot()
    expect(before).toHaveLength(DOCUMENTS)

    const copy = run(['backup', '--project', PROJECT, '--out', folder])
    expect(copy.code, copy.err).toBe(0)
    expect(copy.out).toContain(`${DOCUMENTS} documents`)
    const [file] = copyFiles()
    const path = join(folder, file)

    const check = run(['verify', path])
    expect(check.code, check.err).toBe(0)
    expect(check.out).toContain(`${DOCUMENTS} documents of ${PROJECT}`)

    await clearDatabase()
    expect(await snapshot()).toHaveLength(0)

    // Without --apply it says what it would do and writes nothing
    const dryRun = run(['restore', path, '--project', PROJECT])
    expect(dryRun.code, dryRun.err).toBe(0)
    expect(dryRun.out).toContain(`${DOCUMENTS} new`)
    expect(dryRun.out).toContain('Nothing was written')
    expect(await snapshot()).toHaveLength(0)

    const restore = run(['restore', path, '--project', PROJECT, '--apply', '--confirm', PROJECT])
    expect(restore.code, restore.err).toBe(0)
    expect(await snapshot()).toEqual(before)
    // It starts the command line four times, and each start loads the Firestore client: about 20 s on Windows
  }, 60_000)

  it('does not replace what already exists when it is restored again', async () => {
    await seed()
    run(['backup', '--project', PROJECT, '--out', folder])
    const path = join(folder, copyFiles()[0])
    await db.doc('flats/f1/members/m0').update({ name: 'Ana, edited after the copy' })

    const again = run(['restore', path, '--project', PROJECT, '--apply', '--confirm', PROJECT])
    expect(again.code, again.err).toBe(0)
    expect(again.out).toContain(`0 new, 0 replaced, ${DOCUMENTS} left as they are`)
    expect((await db.doc('flats/f1/members/m0').get()).data().name).toBe(
      'Ana, edited after the copy',
    )

    const forced = run([
      'restore',
      path,
      '--project',
      PROJECT,
      '--apply',
      '--confirm',
      PROJECT,
      '--overwrite',
    ])
    expect(forced.code, forced.err).toBe(0)
    expect((await db.doc('flats/f1/members/m0').get()).data().name).toBe('Ana')
  })

  it('writes the file encrypted, with a manifest that holds no data', async () => {
    await seed()
    run(['backup', '--project', PROJECT, '--out', folder])
    const [file] = copyFiles()
    const raw = readFileSync(join(folder, file))
    expect(raw.includes(Buffer.from('Groceries'))).toBe(false)
    expect(raw.includes(Buffer.from('owner-uid'))).toBe(false)

    const manifestText = readFileSync(join(folder, `${file}.manifest.json`), 'utf8')
    const manifest = JSON.parse(manifestText)
    expect(manifest).toMatchObject({ projectId: PROJECT, documentCount: DOCUMENTS })
    expect(manifest.collections).toMatchObject({ flats: 5, inviteCodes: 1, misc: 1 })
    expect(manifestText).not.toMatch(/Groceries|Ana|owner-uid/)
  })

  it('refuses a wrong passphrase, and a file that was changed', async () => {
    await seed()
    run(['backup', '--project', PROJECT, '--out', folder])
    const path = join(folder, copyFiles()[0])

    const wrong = run(['verify', path], { BACKUP_PASSPHRASE: 'another long passphrase here' })
    expect(wrong.code).toBe(1)
    expect(wrong.err).toMatch(/wrong passphrase or damaged/i)

    const bytes = readFileSync(path)
    bytes[bytes.length - 1] ^= 1
    writeFileSync(path, bytes)
    const changed = run(['verify', path])
    expect(changed.code).toBe(1)
    expect(changed.err).toMatch(/wrong passphrase or damaged/i)
  })

  it('stops before spending the quota when the database is bigger than the limit, and leaves no file', async () => {
    await seed()
    const result = run(['backup', '--project', PROJECT, '--out', folder, '--max-documents', '3'])
    expect(result.code).toBe(1)
    expect(result.err).toMatch(/more than 3 documents/)
    expect(copyFiles()).toEqual([])
    expect(existsSync(join(folder, 'housely-prod'))).toBe(false)
  })

  it('does not write by mistake: no --confirm, or the copy of another project', async () => {
    await seed()
    run(['backup', '--project', PROJECT, '--out', folder])
    const path = join(folder, copyFiles()[0])
    await clearDatabase()

    const unconfirmed = run(['restore', path, '--project', PROJECT, '--apply'])
    expect(unconfirmed.code).toBe(2)
    expect(await snapshot()).toHaveLength(0)

    const other = run(['restore', path, '--project', 'housely-ci'])
    expect(other.code).toBe(2)
    expect(other.err).toMatch(/demo-housely.*housely-ci/s)
    expect(await snapshot()).toHaveLength(0)
  })
})
