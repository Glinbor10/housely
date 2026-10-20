import { translate, type MessageKey } from '../i18n/i18n'

const CODES = [
  'flat-name-required',
  'flat-name-too-long',
  'members-required',
  'members-too-many',
  'member-name-too-long',
  'members-duplicated',
  'zones-required',
  'zones-too-many',
  'zone-name-too-long',
  'zone-name-invalid',
  'zones-duplicated',
  'start-date-invalid',
  'owner-required',
] as const

const isKnown = (code: string): code is (typeof CODES)[number] =>
  (CODES as readonly string[]).includes(code)

// Turns the error codes of the domain into text for the user, in the current language.
export const describeDraftError = (code: string): string =>
  translate(isKnown(code) ? (`create.error.${code}` as MessageKey) : 'create.error.generic')
