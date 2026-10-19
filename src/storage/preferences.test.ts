import { describe, expect, it } from 'vitest'
import { dismissInstallHint, isInstallHintDismissed } from './preferences'

const createStorage = () => {
  const data: Record<string, string> = {}
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

describe('install hint preference', () => {
  it('is not dismissed by default', () => {
    expect(isInstallHintDismissed(createStorage())).toBe(false)
  })

  it('stays dismissed once the person closes it', () => {
    const storage = createStorage()
    dismissInstallHint(storage)
    expect(isInstallHintDismissed(storage)).toBe(true)
  })

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
    }
    expect(isInstallHintDismissed(broken)).toBe(false)
    expect(() => dismissInstallHint(broken)).not.toThrow()
  })
})
