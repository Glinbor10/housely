import { describe, expect, it } from 'vitest'
import {
  dismissInstallHint,
  dismissSaveAccess,
  isInstallHintDismissed,
  isSaveAccessDismissed,
} from './preferences'

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

describe('save access banner preference', () => {
  it('is shown by default and stays dismissed once the person says not now', () => {
    const storage = createStorage()
    expect(isSaveAccessDismissed(storage)).toBe(false)
    dismissSaveAccess(storage)
    expect(isSaveAccessDismissed(storage)).toBe(true)
  })

  it('is independent from the install hint', () => {
    const storage = createStorage()
    dismissInstallHint(storage)
    expect(isSaveAccessDismissed(storage)).toBe(false)
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
    expect(isSaveAccessDismissed(broken)).toBe(false)
    expect(() => dismissSaveAccess(broken)).not.toThrow()
  })
})
