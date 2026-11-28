// Reads the whole database, collection by collection and document by document, with the same
// order every time. It talks to Firestore only through a few calls, so it is easy to test.
import { encodeValue } from './serialize.mjs'

// Every document read counts against the free quota (50,000 reads a day on the Spark plan): the limit
// stops a copy of a database that is bigger than expected before it reads the documents. The names
// of the documents of one collection are listed in one go, so a huge collection costs that listing.
export const DEFAULT_MAX_DOCUMENTS = 10_000

const LOOKUP_SIZE = 100

export class BackupLimitError extends Error {
  name = 'BackupLimitError'
}

export const dumpDatabase = async (
  db,
  { maxDocuments = DEFAULT_MAX_DOCUMENTS, onProgress = () => {} } = {},
) => {
  const documents = []
  // Everything that was listed, also what holds only subcollections: that is what costs
  let visited = 0

  const walk = async (collections) => {
    for (const collection of collections) {
      // The references include the paths where no document is stored but there are subcollections
      // below, as users/{uid}/... in this project. Asking only for the documents that exist would
      // lose everything under them without a word.
      const references = await collection.listDocuments()
      visited += references.length
      if (visited > maxDocuments) {
        throw new BackupLimitError(
          `The database has more than ${maxDocuments} documents: the copy was stopped before ` +
            'reading them. Raise the limit on purpose if that is what you want.',
        )
      }
      for (let start = 0; start < references.length; start += LOOKUP_SIZE) {
        const snapshots = await db.getAll(...references.slice(start, start + LOOKUP_SIZE))
        for (const snapshot of snapshots) {
          if (!snapshot.exists) continue
          documents.push({ path: snapshot.ref.path, data: encodeValue(snapshot.data()) })
          onProgress(documents.length)
        }
      }
      for (const reference of references) {
        await walk(await reference.listCollections())
      }
    }
  }

  await walk(await db.listCollections())
  documents.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return {
    documents,
    documentCount: documents.length,
    // One read for each path that was visited, and one more to ask what hangs below it
    estimatedReads: visited * 2,
  }
}
