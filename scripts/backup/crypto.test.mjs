import { describe, expect, it } from 'vitest'
import { decryptBuffer, encryptBuffer, MIN_PASSPHRASE_LENGTH } from './crypto.mjs'

const passphrase = 'a long passphrase for the tests'
const secret = Buffer.from('{"name":"Ana","amountCents":3050}')

describe('encryptBuffer and decryptBuffer', () => {
  it('gives back exactly what was saved', () => {
    expect(decryptBuffer(encryptBuffer(secret, passphrase), passphrase)).toEqual(secret)
  })

  it('does not leave the content readable in the file', () => {
    const file = encryptBuffer(secret, passphrase)
    expect(file.includes(Buffer.from('Ana'))).toBe(false)
    expect(file.includes(Buffer.from('amountCents'))).toBe(false)
  })

  it('never writes the same file twice, even for the same content', () => {
    expect(encryptBuffer(secret, passphrase).equals(encryptBuffer(secret, passphrase))).toBe(false)
  })

  it('refuses a wrong passphrase, and says so', () => {
    const file = encryptBuffer(secret, passphrase)
    expect(() => decryptBuffer(file, 'another long passphrase here')).toThrow(
      /wrong passphrase or damaged/i,
    )
  })

  it('refuses a file that was changed, even by one byte', () => {
    const file = encryptBuffer(secret, passphrase)
    file[file.length - 1] ^= 1
    expect(() => decryptBuffer(file, passphrase)).toThrow(/wrong passphrase or damaged/i)
  })

  it('refuses something that is not one of our backups', () => {
    expect(() => decryptBuffer(Buffer.from('just some text, nothing else'), passphrase)).toThrow(
      /not a housely backup/i,
    )
  })

  it('refuses a passphrase that is too short, before writing anything', () => {
    expect(() => encryptBuffer(secret, 'short')).toThrow(
      new RegExp(`at least ${MIN_PASSPHRASE_LENGTH}`),
    )
    expect(() => encryptBuffer(secret, '')).toThrow(/passphrase/i)
    expect(() => encryptBuffer(secret, undefined)).toThrow(/passphrase/i)
  })
})
