import { Timestamp } from '@google-cloud/firestore'
import { describe, expect, it } from 'vitest'
import { BackupLimitError, dumpDatabase } from './dump.mjs'

// A database in memory with the calls that the dump uses. `tree` is { collection: { id: { data, collections } } }.
// A node without `data` is a document that does not exist but has subcollections, as it happens in Firestore.
const fakeDb = (tree) => {
  const reference = (path, node) => ({
    path,
    node,
    listCollections: async () =>
      Object.entries(node.collections ?? {}).map(([name, documents]) =>
        collection(`${path}/${name}`, documents),
      ),
  })
  const collection = (path, documents) => ({
    id: path.split('/').pop(),
    // Lists the documents that exist and also the ones that only hold subcollections
    listDocuments: async () =>
      Object.entries(documents).map(([id, node]) => reference(`${path}/${id}`, node)),
  })
  return {
    listCollections: async () =>
      Object.entries(tree).map(([name, documents]) => collection(name, documents)),
    getAll: async (...references) =>
      references.map((ref) => ({
        exists: ref.node.data !== undefined,
        ref,
        data: () => ref.node.data,
      })),
  }
}

const flatTree = {
  flats: {
    f1: {
      data: { name: 'My flat', createdAt: new Timestamp(1_760_000_000, 0) },
      collections: {
        members: {
          m0: { data: { name: 'Ana', order: 0 } },
          m1: { data: { name: 'Ben', order: 1 } },
        },
        expenses: { e1: { data: { title: 'Groceries', amountCents: 3050 } } },
      },
    },
  },
  inviteCodes: { ABC123: { data: { flatId: 'f1' } } },
}

describe('dumpDatabase', () => {
  it('reads every collection, however deep, with the full path of each document', async () => {
    const { documents } = await dumpDatabase(fakeDb(flatTree))
    expect(documents.map((document) => document.path)).toEqual([
      'flats/f1',
      'flats/f1/expenses/e1',
      'flats/f1/members/m0',
      'flats/f1/members/m1',
      'inviteCodes/ABC123',
    ])
  })

  it('finds what is under a document that does not exist, as the homes of a person under userFlats', async () => {
    // In Firestore a subcollection can live under a path where nothing is stored: only the documents below it are
    const tree = {
      userFlats: { 'owner-uid': { collections: { flats: { f1: { data: { memberId: 'm0' } } } } } },
    }
    const { documents, documentCount } = await dumpDatabase(fakeDb(tree))
    expect(documents.map((document) => document.path)).toEqual(['userFlats/owner-uid/flats/f1'])
    expect(documentCount).toBe(1)
  })

  it('writes the same order every time, so two copies of the same data can be compared', async () => {
    const first = await dumpDatabase(fakeDb(flatTree))
    const second = await dumpDatabase(fakeDb(flatTree))
    expect(second.documents).toEqual(first.documents)
  })

  it('writes the values with their type, ready for a JSON file', async () => {
    const { documents } = await dumpDatabase(fakeDb(flatTree))
    const flat = documents.find((document) => document.path === 'flats/f1')
    expect(flat.data.createdAt).toEqual({
      __type: 'timestamp',
      seconds: 1_760_000_000,
      nanoseconds: 0,
    })
    expect(JSON.parse(JSON.stringify(documents))).toEqual(documents)
  })

  it('counts the documents, and says how many reads it cost', async () => {
    const result = await dumpDatabase(fakeDb(flatTree))
    expect(result.documentCount).toBe(5)
    // One read per document, and one more per document to ask for its subcollections
    expect(result.estimatedReads).toBe(10)
  })

  it('works with an empty database', async () => {
    const result = await dumpDatabase(fakeDb({}))
    expect(result).toMatchObject({ documents: [], documentCount: 0, estimatedReads: 0 })
  })

  it('stops before spending the free quota when the database is bigger than the limit', async () => {
    await expect(dumpDatabase(fakeDb(flatTree), { maxDocuments: 3 })).rejects.toBeInstanceOf(
      BackupLimitError,
    )
    await expect(dumpDatabase(fakeDb(flatTree), { maxDocuments: 3 })).rejects.toThrow(
      /more than 3 documents/i,
    )
  })

  it('reports its progress, so a long copy does not look frozen', async () => {
    const seen = []
    await dumpDatabase(fakeDb(flatTree), { onProgress: (count) => seen.push(count) })
    expect(seen.at(-1)).toBe(5)
  })
})
