import { toIsoDate } from './completions'

export interface FlatDraft {
  name: string
  members: string[]
  zones: string[]
  // Local calendar date, YYYY-MM-DD: first day of the rotation
  startDate: string
}

// Limits mirror the Firestore rules (firebase/firestore/firestore.rules).
const MAX_FLAT_NAME = 60
const MAX_MEMBER_NAME = 40
const MAX_ZONE_NAME = 60
const MAX_ITEMS = 20

// No 0, 1, O or I: codes are read aloud and typed by hand.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_CODE_LENGTH = 6

const cleanText = (value: string): string => value.trim().replace(/\s+/g, ' ')

export const normalizeDraft = (draft: FlatDraft): FlatDraft => ({
  ...draft,
  name: cleanText(draft.name),
  members: draft.members.map(cleanText).filter(Boolean),
  zones: draft.zones.map(cleanText).filter(Boolean),
})

const hasDuplicates = (values: string[]): boolean =>
  new Set(values.map((value) => value.toLowerCase())).size !== values.length

const isValidIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// Returns error codes (never user-facing text) so the UI can localize them.
export const validateDraft = (draft: FlatDraft): string[] => {
  const errors: string[] = []
  if (draft.name.length === 0) errors.push('flat-name-required')
  if (draft.name.length > MAX_FLAT_NAME) errors.push('flat-name-too-long')

  if (draft.members.length === 0) errors.push('members-required')
  if (draft.members.length > MAX_ITEMS) errors.push('members-too-many')
  if (draft.members.some((member) => member.length > MAX_MEMBER_NAME)) {
    errors.push('member-name-too-long')
  }
  if (hasDuplicates(draft.members)) errors.push('members-duplicated')

  if (draft.zones.length === 0) errors.push('zones-required')
  if (draft.zones.length > MAX_ITEMS) errors.push('zones-too-many')
  if (draft.zones.some((zone) => zone.length > MAX_ZONE_NAME)) errors.push('zone-name-too-long')
  if (draft.zones.some((zone) => zone.includes('/'))) errors.push('zone-name-invalid')
  if (hasDuplicates(draft.zones)) errors.push('zones-duplicated')

  if (!isValidIsoDate(draft.startDate)) errors.push('start-date-invalid')
  return errors
}

// The random source is injected so the function stays pure and testable.
export const generateInviteCode = (random: () => number): string =>
  Array.from(
    { length: INVITE_CODE_LENGTH },
    () => INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)],
  ).join('')

// Monday of the week of the given date: the natural start of a weekly rotation.
export const getMondayIso = (date: Date): string => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return toIsoDate(monday)
}
