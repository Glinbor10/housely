import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The file that tells Android that the app belongs to the website. Chrome reads it from the website, so
// it must be valid and must only name the package of the app and SHA-256 fingerprints of its key.
const links: Array<{
  relation: string[]
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] }
}> = JSON.parse(readFileSync('public/.well-known/assetlinks.json', 'utf8'))

describe('assetlinks.json', () => {
  it('only links the package of the Android app, with fingerprints of the right shape', () => {
    for (const link of links) {
      expect(link.relation).toEqual(['delegate_permission/common.handle_all_urls'])
      expect(link.target.namespace).toBe('android_app')
      expect(link.target.package_name).toBe('io.github.glinbor10.housely')
      for (const fingerprint of link.target.sha256_cert_fingerprints) {
        // Thirty two bytes in hexadecimal separated by colons
        expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
      }
    }
  })

  it('is served by the hosting, which would otherwise ignore folders that start with a dot', () => {
    const hosting = JSON.parse(readFileSync('firebase/firebase.json', 'utf8')).hosting
    expect(hosting.ignore).not.toContain('**/.*')
  })
})
