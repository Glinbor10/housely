import { en } from './en'
import { es } from './es'

export type Locale = 'en' | 'es'
export type MessageKey = keyof typeof en

export const LOCALES: readonly Locale[] = ['en', 'es']

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, es }
const STORAGE_KEY = 'housely:locale'

interface LocaleStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && LOCALES.includes(value as Locale)

// The first language of the device (in order of preference) that the app speaks.
export const detectLocale = (languages: readonly string[]): Locale => {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return 'en'
}

let current: Locale = 'en'
let storage: LocaleStorage | null = null
const listeners = new Set<() => void>()

export const getLocale = (): Locale => current

export const subscribeLocale = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const setLocale = (locale: Locale): void => {
  if (locale === current) return
  current = locale
  document.documentElement.lang = locale
  try {
    storage?.setItem(STORAGE_KEY, locale)
  } catch {
    // Without storage the choice simply is not remembered.
  }
  listeners.forEach((listener) => listener())
}

// Called once at startup: the saved choice wins over the language of the device.
export const initLocale = (
  localeStorage: LocaleStorage,
  languages: readonly string[] = navigator.languages,
): void => {
  storage = localeStorage
  let saved: string | null = null
  try {
    saved = localeStorage.getItem(STORAGE_KEY)
  } catch {
    // Without storage the language of the device is used.
  }
  const locale = isLocale(saved) ? saved : detectLocale(languages)
  current = locale
  document.documentElement.lang = locale
  listeners.forEach((listener) => listener())
}

// Looks a text up in the current language and fills in its {placeholders}.
export const translate = (key: MessageKey, params: Record<string, string | number> = {}): string =>
  DICTIONARIES[current][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  )
