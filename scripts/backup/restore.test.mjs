import { Timestamp } from '@google-cloud/firestore'
import { describe, expect, it } from 'vitest'
import { restoreDocuments } from './restore.mjs'

// A database in memory with the calls that the restore uses. `stored` is { path: data }
const fakeDb = (stored = {}) => {
  const data = new Map(Object.entries(stored))
  const commits = []
  return {
    data,
    commits,
    doc: (path) => ({ path }),
    getAll: async (...refs) => refs.map((ref) => ({ exists: data.has(ref.path) })),
    batch: () => {
      const operations = []
      return {
        set: (ref, value) => operations.push([ref.path, value]),
        commit: async () => {
          commits.push(operations.length)
          for (const [path, value] of operations) data.set(path, value)
        },
      }
    },
  }
}

const documents = [
  {
    path: 'flats/f1',
    data: { name: 'My flat', createdAt: { __type: 'timestamp', seconds: 5, nanoseconds: 7 } },
  },
  { path: 'flats/f1/members/m0', data: { name: 'Ana' } },
  { path: 'flats/f1/members/m1', data: { name: 'Ben' } },
]

describe('restoreDocuments', () => {
  it('writes nothing unless it is told to apply, and says what it would do', async () => {
    const db = fakeDb()
    const summary = await restoreDocuments(db, documents)
    expect(db.data.size).toBe(0)
    expect(db.commits).toEqual([])
    expect(summary).toEqual({ applied: false, create: 3, overwrite: 0, skip: 0 })
  })

  it('writes the missing documents when it is told to apply', async () => {
    const db = fakeDb()
    const summary = await restoreDocuments(db, documents, { apply: true })
    expect([...db.data.keys()].sort()).toEqual(documents.map((document) => document.path).sort())
    expect(summary).toEqual({ applied: true, create: 3, overwrite: 0, skip: 0 })
  })

  it('brings the types back, not just the text', async () => {
    const db = fakeDb()
    await restoreDocuments(db, documents, { apply: true })
    const createdAt = db.data.get('flats/f1').createdAt
    expect(createdAt).toBeInstanceOf(Timestamp)
    expect(createdAt.nanoseconds).toBe(7)
  })

  it('does not touch a document that already exists, which may be newer than the copy', async () => {
    const db = fakeDb({ 'flats/f1/members/m0': { name: 'Ana, edited today' } })
    const summary = await restoreDocuments(db, documents, { apply: true })
    expect(db.data.get('flats/f1/members/m0')).toEqual({ name: 'Ana, edited today' })
    expect(summary).toEqual({ applied: true, create: 2, overwrite: 0, skip: 1 })
  })

  it('replaces what exists only when it is asked to on purpose', async () => {
    const db = fakeDb({ 'flats/f1/members/m0': { name: 'Ana, edited today' } })
    const summary = await restoreDocuments(db, documents, { apply: true, overwrite: true })
    expect(db.data.get('flats/f1/members/m0')).toEqual({ name: 'Ana' })
    expect(summary).toEqual({ applied: true, create: 2, overwrite: 1, skip: 0 })
  })

  it('writes in batches that stay below the limit of Firestore', async () => {
    const many = Array.from({ length: 450 }, (_, index) => ({
      path: `flats/f1/completions/c${index}`,
      data: { index },
    }))
    const db = fakeDb()
    await restoreDocuments(db, many, { apply: true })
    expect(db.data.size).toBe(450)
    expect(Math.max(...db.commits)).toBeLessThanOrEqual(400)
    expect(db.commits.reduce((a, b) => a + b, 0)).toBe(450)
  })

  it('shows the progress of what it writes', async () => {
    const seen = []
    await restoreDocuments(fakeDb(), documents, {
      apply: true,
      onProgress: (done) => seen.push(done),
    })
    expect(seen.at(-1)).toBe(3)
  })
})
