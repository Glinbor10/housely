// The file of a copy: what goes inside it, how it is named and how it is read back. Reading is strict on
// purpose: a restore must refuse a copy that is incomplete or odd, never guess.
import { createHash } from 'node:crypto'

export const FORMAT = 'housely-firestore-backup'
export const VERSION = 1

export const buildBackup = ({ projectId, documents, createdAt }) => ({
  format: FORMAT,
  version: VERSION,
  projectId,
  createdAt: createdAt.toISOString(),
  documentCount: documents.length,
  documents,
})

export const serializeBackup = (backup) => Buffer.from(JSON.stringify(backup), 'utf8')

// The path of a document has an even number of parts (collection, document, collection, document...)
const isDocumentPath = (path) => {
  const parts = typeof path === 'string' ? path.split('/') : []
  return parts.length >= 2 && parts.length % 2 === 0 && parts.every((part) => part !== '')
}

export const parseBackup = (buffer) => {
  let backup
  try {
    backup = JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new Error('The backup is not valid JSON: it is damaged or it was not decrypted')
  }
  if (backup === null || typeof backup !== 'object' || backup.format !== FORMAT) {
    throw new Error('This is not a Housely Firestore backup')
  }
  if (backup.version !== VERSION) {
    throw new Error(
      `This backup uses version ${backup.version} of the format and this tool understands version ${VERSION}`,
    )
  }
  if (typeof backup.projectId !== 'string' || backup.projectId === '') {
    throw new Error('The backup does not say which project it comes from')
  }
  if (!Array.isArray(backup.documents)) {
    throw new Error('The backup has no list of documents')
  }
  if (backup.documents.length !== backup.documentCount) {
    throw new Error(
      `The backup holds ${backup.documents.length} documents but says it has ${backup.documentCount}: it is incomplete`,
    )
  }
  for (const document of backup.documents) {
    if (!isDocumentPath(document?.path)) {
      throw new Error(`Invalid path in the backup: "${document?.path}"`)
    }
  }
  return backup
}

const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

// The UTC moment goes in the name, so the copies sort by date and two never share a name
export const backupFileName = (projectId, createdAt) => {
  const stamp = createdAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
  return `${slug(projectId)}-${stamp}.hsbk`
}

// What the copy holds, without any of its data: it can be read, shared or kept in the open
export const buildManifest = ({ projectId, createdAt, documents, encrypted }) => {
  const collections = {}
  for (const { path } of documents) {
    const name = path.split('/')[0]
    collections[name] = (collections[name] ?? 0) + 1
  }
  return {
    format: FORMAT,
    version: VERSION,
    projectId,
    createdAt: createdAt.toISOString(),
    documentCount: documents.length,
    collections,
    bytes: encrypted.length,
    sha256: createHash('sha256').update(encrypted).digest('hex'),
  }
}
