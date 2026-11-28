import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  buildBackup,
  buildManifest,
  parseBackup,
  serializeBackup,
} from './backupFile.mjs'

const documents = [
  { path: 'flats/f1', data: { name: 'My flat' } },
  { path: 'flats/f1/members/m0', data: { name: 'Ana' } },
  { path: 'inviteCodes/ABC123', data: { flatId: 'f1' } },
]
const createdAt = new Date('2026-11-13T12:30:45.123Z')

describe('buildBackup, serializeBackup and parseBackup', () => {
  it('gives back the same documents it was given', () => {
    const backup = buildBackup({ projectId: 'housely-prod', documents, createdAt })
    expect(parseBackup(serializeBackup(backup))).toEqual(backup)
    expect(backup).toMatchObject({
      format: 'housely-firestore-backup',
      version: 1,
      projectId: 'housely-prod',
      createdAt: '2026-11-13T12:30:45.123Z',
      documentCount: 3,
    })
  })

  it.each([
    ['text that is not JSON', 'not json at all', /not valid json/i],
    ['another kind of file', JSON.stringify({ format: 'something-else' }), /not a housely/i],
    [
      'a newer version of the format',
      JSON.stringify({ format: 'housely-firestore-backup', version: 2 }),
      /version 2/i,
    ],
  ])('refuses %s', (_, content, message) => {
    expect(() => parseBackup(Buffer.from(content))).toThrow(message)
  })

  it('refuses a backup whose count does not match its documents, which means it is incomplete', () => {
    const backup = buildBackup({ projectId: 'housely-prod', documents, createdAt })
    backup.documentCount = 99
    expect(() => parseBackup(serializeBackup(backup))).toThrow(/3 documents.*99/i)
  })

  it('refuses a path that is not the path of a document, so nothing odd is ever written', () => {
    for (const path of ['flats', 'flats/f1/members', '', '/flats/f1', 'flats//f1']) {
      const backup = buildBackup({
        projectId: 'housely-prod',
        documents: [{ path, data: {} }],
        createdAt,
      })
      expect(() => parseBackup(serializeBackup(backup))).toThrow(/invalid path/i)
    }
  })

  it('refuses a backup without the project it comes from', () => {
    const backup = buildBackup({ projectId: '', documents, createdAt })
    expect(() => parseBackup(serializeBackup(backup))).toThrow(/project/i)
  })
})

describe('backupFileName', () => {
  it('names the file after the project and the UTC moment, so the copies sort by date', () => {
    expect(backupFileName('housely-prod', createdAt)).toBe('housely-prod-20261113T123045Z.hsbk')
  })

  it('does not let the project name write outside the folder', () => {
    expect(backupFileName('../../etc/passwd', createdAt)).toBe('etc-passwd-20261113T123045Z.hsbk')
  })
})

describe('buildManifest', () => {
  const encrypted = Buffer.from('pretend this is the encrypted file')

  it('says what the copy holds, without any of its data', () => {
    const manifest = buildManifest({ projectId: 'housely-prod', createdAt, documents, encrypted })
    expect(manifest).toMatchObject({
      projectId: 'housely-prod',
      createdAt: '2026-11-13T12:30:45.123Z',
      documentCount: 3,
      collections: { flats: 2, inviteCodes: 1 },
      bytes: encrypted.length,
    })
    expect(JSON.stringify(manifest)).not.toMatch(/Ana|My flat|ABC123/)
  })

  it('carries the fingerprint of the encrypted file, to notice a copy that was damaged', () => {
    const manifest = buildManifest({ projectId: 'housely-prod', createdAt, documents, encrypted })
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/)
    const other = buildManifest({
      projectId: 'housely-prod',
      createdAt,
      documents,
      encrypted: Buffer.from('another file'),
    })
    expect(other.sha256).not.toBe(manifest.sha256)
  })
})
