// Puts the documents of a copy back. It writes nothing unless it is told to, and it never replaces a
// document that exists unless it is told to: what is in the database now may be newer than the copy.
import { decodeValue } from './serialize.mjs'

// Firestore accepts 500 writes in a batch: this stays well below it
const BATCH_SIZE = 400
const LOOKUP_SIZE = 100

export const restoreDocuments = async (
  db,
  documents,
  { apply = false, overwrite = false, onProgress = () => {} } = {},
) => {
  const summary = { applied: apply, create: 0, overwrite: 0, skip: 0 }
  const planned = []

  for (let start = 0; start < documents.length; start += LOOKUP_SIZE) {
    const chunk = documents.slice(start, start + LOOKUP_SIZE)
    const refs = chunk.map((document) => db.doc(document.path))
    const snapshots = await db.getAll(...refs)
    chunk.forEach((document, index) => {
      if (!snapshots[index].exists) {
        summary.create += 1
        planned.push({ document, ref: refs[index] })
      } else if (overwrite) {
        summary.overwrite += 1
        planned.push({ document, ref: refs[index] })
      } else {
        summary.skip += 1
      }
    })
  }

  if (!apply) return summary

  let written = 0
  for (let start = 0; start < planned.length; start += BATCH_SIZE) {
    const chunk = planned.slice(start, start + BATCH_SIZE)
    const batch = db.batch()
    for (const { document, ref } of chunk) batch.set(ref, decodeValue(document.data, db))
    await batch.commit()
    written += chunk.length
    onProgress(written)
  }
  return summary
}
