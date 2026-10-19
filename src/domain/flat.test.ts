import { describe, expect, it } from 'vitest'
import { generateInviteCode, getMondayIso, normalizeDraft, validateDraft } from './flat'

const draft = {
  name: 'My flat',
  members: ['Ana', 'Ben', 'Carl'],
  zones: ['Living room', 'Kitchen', 'Bathroom'],
  startDate: '2026-10-12',
}

describe('normalizeDraft', () => {
  it('trims names and drops empty entries', () => {
    expect(
      normalizeDraft({
        ...draft,
        name: '  My flat ',
        members: [' Ana ', '', '  '],
        zones: ['Kitchen '],
      }),
    ).toEqual({ ...draft, members: ['Ana'], zones: ['Kitchen'] })
  })

  it('collapses inner whitespace', () => {
    expect(normalizeDraft({ ...draft, members: ['Ana   Maria'] }).members).toEqual(['Ana Maria'])
  })
})

describe('validateDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateDraft(draft)).toEqual([])
  })

  it('requires a flat name of at most 60 characters', () => {
    expect(validateDraft({ ...draft, name: '' })).toContain('flat-name-required')
    expect(validateDraft({ ...draft, name: 'x'.repeat(61) })).toContain('flat-name-too-long')
  })

  it('requires at least one member and at most 20', () => {
    expect(validateDraft({ ...draft, members: [] })).toContain('members-required')
    expect(
      validateDraft({ ...draft, members: Array.from({ length: 21 }, (_, i) => `P${i}`) }),
    ).toContain('members-too-many')
  })

  it('requires at least one zone and at most 20', () => {
    expect(validateDraft({ ...draft, zones: [] })).toContain('zones-required')
    expect(
      validateDraft({ ...draft, zones: Array.from({ length: 21 }, (_, i) => `Z${i}`) }),
    ).toContain('zones-too-many')
  })

  it('rejects names longer than 40 characters for members and 60 for zones', () => {
    expect(validateDraft({ ...draft, members: ['x'.repeat(41)] })).toContain('member-name-too-long')
    expect(validateDraft({ ...draft, zones: ['x'.repeat(61)] })).toContain('zone-name-too-long')
  })

  it('rejects zone names with a slash: they are part of a Firestore document id', () => {
    expect(validateDraft({ ...draft, zones: ['Bath/Toilet'] })).toContain('zone-name-invalid')
  })

  it('rejects duplicated names ignoring case', () => {
    expect(validateDraft({ ...draft, members: ['Ana', 'ana'] })).toContain('members-duplicated')
    expect(validateDraft({ ...draft, zones: ['Kitchen', 'KITCHEN'] })).toContain('zones-duplicated')
  })

  it('requires a valid ISO start date', () => {
    expect(validateDraft({ ...draft, startDate: '' })).toContain('start-date-invalid')
    expect(validateDraft({ ...draft, startDate: '12/10/2026' })).toContain('start-date-invalid')
    expect(validateDraft({ ...draft, startDate: '2026-02-31' })).toContain('start-date-invalid')
  })

  it('reports every problem at once', () => {
    expect(validateDraft({ name: '', members: [], zones: [], startDate: '' })).toEqual([
      'flat-name-required',
      'members-required',
      'zones-required',
      'start-date-invalid',
    ])
  })
})

describe('generateInviteCode', () => {
  it('builds a 6 character code from the unambiguous alphabet', () => {
    const code = generateInviteCode(() => 0)
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
  })

  it('uses the random source for every character', () => {
    const values = [0, 0.5, 0.99, 0.25, 0.75, 0.1]
    let index = 0
    const first = generateInviteCode(() => values[index++ % values.length])
    index = 0
    expect(generateInviteCode(() => values[index++ % values.length])).toBe(first)
    expect(generateInviteCode(() => 0.9)).not.toBe(generateInviteCode(() => 0.1))
  })

  it('never produces characters that look alike', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateInviteCode(Math.random)).not.toMatch(/[01OI]/)
    }
  })
})

describe('getMondayIso', () => {
  it('returns the Monday of the week of a given date', () => {
    expect(getMondayIso(new Date('2026-10-14T10:00:00'))).toBe('2026-10-12')
  })

  it('returns the same day for a Monday', () => {
    expect(getMondayIso(new Date('2026-10-12T00:00:00'))).toBe('2026-10-12')
  })

  it('treats Sunday as the end of the week', () => {
    expect(getMondayIso(new Date('2026-10-18T23:59:00'))).toBe('2026-10-12')
  })

  it('crosses month and year boundaries', () => {
    expect(getMondayIso(new Date('2027-01-01T12:00:00'))).toBe('2026-12-28')
  })
})
