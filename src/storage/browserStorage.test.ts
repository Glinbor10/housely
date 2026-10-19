import { describe, expect, it } from 'vitest'
import { getBrowserStorage, loadSession, saveSession } from './session'

// This suite runs in Node, where there is no window.localStorage: the in-memory fallback must work.
describe('getBrowserStorage', () => {
  it('falls back to an in-memory storage when localStorage is not available', () => {
    const storage = getBrowserStorage()
    storage.setItem('key', 'value')
    expect(storage.getItem('key')).toBe('value')
    storage.removeItem('key')
    expect(storage.getItem('key')).toBeNull()
  })

  it('returns null for keys that were never set', () => {
    expect(getBrowserStorage().getItem('never-set')).toBeNull()
  })

  it('keeps a session between calls', () => {
    saveSession(getBrowserStorage(), { flatId: 'flat1', memberId: 'm1' })
    expect(loadSession(getBrowserStorage())).toEqual({ flatId: 'flat1', memberId: 'm1' })
  })
})
