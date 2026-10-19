import { describe, expect, it } from 'vitest'
import { clearSession, loadSession, saveSession } from './session'

const createStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    removeItem: (key: string) => {
      delete data[key]
    },
  }
}

describe('session', () => {
  it('returns null when nothing was saved', () => {
    expect(loadSession(createStorage())).toBeNull()
  })

  it('saves and loads the flat and member of this device', () => {
    const storage = createStorage()
    saveSession(storage, { flatId: 'flat1', memberId: 'm1' })
    expect(loadSession(storage)).toEqual({ flatId: 'flat1', memberId: 'm1' })
  })

  it('clears the session', () => {
    const storage = createStorage()
    saveSession(storage, { flatId: 'flat1', memberId: 'm1' })
    clearSession(storage)
    expect(loadSession(storage)).toBeNull()
  })

  it.each(['not json', '{}', '{"flatId":1,"memberId":"m"}', '{"flatId":"f"}', 'null', '[]'])(
    'ignores corrupted data: %s',
    (raw) => {
      expect(loadSession(createStorage({ 'housely:session': raw }))).toBeNull()
    },
  )

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadSession(broken)).toBeNull()
    expect(() => saveSession(broken, { flatId: 'f', memberId: 'm' })).not.toThrow()
    expect(() => clearSession(broken)).not.toThrow()
  })
})
