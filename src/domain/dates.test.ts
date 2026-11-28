import { describe, expect, it } from 'vitest'
import { formatDay } from './dates'

describe('formatDay', () => {
  it('says the day and the short month in the language of the person', () => {
    expect(formatDay('2026-10-19', 'en')).toBe('19 Oct')
    expect(formatDay('2026-10-19', 'es')).toBe('19 oct')
  })

  it('never moves a date to another day', () => {
    expect(formatDay('2026-01-01', 'en')).toBe('1 Jan')
    expect(formatDay('2026-12-31', 'en')).toBe('31 Dec')
  })
})
