// Encrypts the backup with a passphrase: it holds names and expenses of real people, so it must be
// unreadable if the file gets lost. AES-256-GCM, which also detects a file that was changed.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

// A line that identifies our files and their format, so that anything else is refused with a clear message
const MAGIC = Buffer.from('HOUSELY-BACKUP-1\n')
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

export const MIN_PASSPHRASE_LENGTH = 12

const assertPassphrase = (passphrase) => {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`The passphrase must have at least ${MIN_PASSPHRASE_LENGTH} characters`)
  }
}

const deriveKey = (passphrase, salt) => scryptSync(passphrase, salt, KEY_LENGTH)

export const encryptBuffer = (plain, passphrase) => {
  assertPassphrase(passphrase)
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
  // The header is authenticated too, so it cannot be swapped without being noticed
  cipher.setAAD(MAGIC)
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), encrypted])
}

export const decryptBuffer = (file, passphrase) => {
  const headerLength = MAGIC.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  if (file.length < headerLength || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('This is not a Housely backup')
  }
  assertPassphrase(passphrase)
  const salt = file.subarray(MAGIC.length, MAGIC.length + SALT_LENGTH)
  const iv = file.subarray(MAGIC.length + SALT_LENGTH, MAGIC.length + SALT_LENGTH + IV_LENGTH)
  const tag = file.subarray(headerLength - TAG_LENGTH, headerLength)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
  decipher.setAAD(MAGIC)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(file.subarray(headerLength)), decipher.final()])
  } catch {
    throw new Error('Wrong passphrase or damaged backup')
  }
}
