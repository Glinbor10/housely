// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from './en'
import { es } from './es'
import {
  detectLocale,
  getLocale,
  initLocale,
  setLocale,
  subscribeLocale,
  translate,
  type MessageKey,
} from './i18n'

const memoryStorage = (initial: Record<string, string> = {}) => {
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

afterEach(() => setLocale('en'))

describe('dictionaries', () => {
  it('Spanish has exactly the same keys as English, so nothing is left untranslated', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no empty text in any language', () => {
    for (const text of [...Object.values(en), ...Object.values(es)]) {
      expect(text.trim()).not.toBe('')
    }
  })

  it('uses the same {placeholders} in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]))
    }
  })
})

describe('translate', () => {
  it('returns the text of the current language', () => {
    setLocale('es')
    expect(translate('welcome.create')).toBe(es['welcome.create'])
    setLocale('en')
    expect(translate('welcome.create')).toBe(en['welcome.create'])
  })

  it('fills in the {placeholders}', () => {
    expect(translate('join.joining', { name: 'Casa Sol' })).toContain('Casa Sol')
  })

  it('leaves an unknown placeholder visible instead of printing "undefined"', () => {
    expect(translate('join.joining', {})).toContain('{name}')
  })
})

describe('detectLocale', () => {
  it('picks Spanish for any Spanish variant', () => {
    expect(detectLocale(['es-ES', 'en'])).toBe('es')
    expect(detectLocale(['es-MX'])).toBe('es')
  })

  it('picks the first language we support, in order of preference', () => {
    expect(detectLocale(['fr-FR', 'es', 'en'])).toBe('es')
    expect(detectLocale(['en-GB', 'es'])).toBe('en')
  })

  it('falls back to English', () => {
    expect(detectLocale(['fr', 'de'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('locale store', () => {
  it('notifies subscribers when the language changes, and only then', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeLocale(listener)
    setLocale('es')
    setLocale('es')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setLocale('en')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('tells the browser the language of the page', () => {
    setLocale('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('remembers the choice and restores it next time', () => {
    const storage = memoryStorage()
    initLocale(storage, ['en'])
    setLocale('es')
    expect(storage.getItem('housely:locale')).toBe('es')

    // A new visit: a fresh page that only has what was saved
    initLocale(memoryStorage({ 'housely:locale': storage.getItem('housely:locale') ?? '' }), ['en'])
    expect(getLocale()).toBe('es')
  })

  it('uses the language of the device when nothing was chosen', () => {
    initLocale(memoryStorage(), ['es-ES'])
    expect(getLocale()).toBe('es')
  })

  it('ignores a stored value it does not know', () => {
    initLocale(memoryStorage({ 'housely:locale': 'klingon' }), ['en'])
    expect(getLocale()).toBe('en')
  })

  it('keeps working when storage is not available', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
    }
    expect(() => initLocale(broken, ['es'])).not.toThrow()
    expect(() => setLocale('en')).not.toThrow()
  })
})
