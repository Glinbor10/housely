import { describe, expect, it } from 'vitest'
import { validateDraft } from '../domain/flat'
import { describeDraftError } from './draftMessages'

describe('describeDraftError', () => {
  it('has a readable message for every code the domain can produce', () => {
    const codes = validateDraft({
      name: 'x'.repeat(61),
      members: Array.from({ length: 21 }, () => 'x'.repeat(41)),
      zones: Array.from({ length: 21 }, () => 'a/b'),
      startDate: '',
    })
    codes.push('owner-required')
    expect(codes.length).toBeGreaterThan(8)
    codes.forEach((code) => {
      const message = describeDraftError(code)
      expect(message.length).toBeGreaterThan(10)
      expect(message).not.toBe(code)
    })
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(describeDraftError('something-new')).toMatch(/check the data/i)
  })
})
