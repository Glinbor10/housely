import { describe, expect, it } from 'vitest'
import type { RotationLayout } from './layouts'
import { applyTakeovers, takeableCleanings, takeoverId, type Takeover } from './takeovers'

const layouts: RotationLayout[] = [
  { fromWeek: 0, members: ['m0', 'm1', 'm2'], zones: ['Living room', 'Kitchen', 'Bathroom'] },
]

// Week 3: m0 has Living room, m1 Kitchen, m2 Bathroom
const takeover = (overrides: Partial<Takeover> = {}): Takeover => ({
  weekIndex: 3,
  zone: 'Kitchen',
  takerId: 'm0',
  fromId: 'm1',
  debtWeek: 1,
  debtZone: 'Bathroom',
  ...overrides,
})

describe('takeoverId', () => {
  it('is the week and the zone, like a completion, so a zone is taken once', () => {
    expect(takeoverId(3, 'Kitchen')).toBe('3_Kitchen')
  })
})

describe('applyTakeovers', () => {
  const assignments = [
    { zone: 'Living room', member: 'm0' },
    { zone: 'Kitchen', member: 'm1' },
    { zone: 'Bathroom', member: 'm2' },
  ]

  it('changes nothing when nobody took a zone', () => {
    expect(applyTakeovers(assignments, [], 3)).toEqual(assignments)
  })

  it('gives the zone to who took it, so a person can have several in a week', () => {
    const result = applyTakeovers(assignments, [takeover()], 3)
    expect(result).toEqual([
      { zone: 'Living room', member: 'm0' },
      { zone: 'Kitchen', member: 'm0' },
      { zone: 'Bathroom', member: 'm2' },
    ])
  })

  it('only applies the takeovers of that week', () => {
    expect(applyTakeovers(assignments, [takeover({ weekIndex: 4 })], 3)).toEqual(assignments)
  })

  it('can give every zone of the week to one person, and no more than that', () => {
    const result = applyTakeovers(
      assignments,
      [takeover(), takeover({ zone: 'Bathroom', fromId: 'm2', debtZone: 'Kitchen' })],
      3,
    )
    expect(result.map(({ member }) => member)).toEqual(['m0', 'm0', 'm0'])
  })
})

describe('takeableCleanings', () => {
  const base = { layouts, completions: [], takeovers: [], currentWeek: 3, memberId: 'm0' }

  it('offers the zones that housemates still have this week and in the weeks that come', () => {
    const result = takeableCleanings({ ...base, weeksAhead: 1 })
    expect(result).toEqual([
      { weekIndex: 3, zone: 'Kitchen', fromId: 'm1' },
      { weekIndex: 3, zone: 'Bathroom', fromId: 'm2' },
      // Week 4 rotates: m0 has Bathroom, m1 Living room, m2 Kitchen
      { weekIndex: 4, zone: 'Living room', fromId: 'm1' },
      { weekIndex: 4, zone: 'Kitchen', fromId: 'm2' },
    ])
  })

  it('does not offer the own zones, nor weeks that are over', () => {
    const result = takeableCleanings({ ...base, weeksAhead: 0 })
    expect(result.every(({ fromId }) => fromId !== 'm0')).toBe(true)
    expect(result.every(({ weekIndex }) => weekIndex >= 3)).toBe(true)
  })

  it('does not offer a zone that is already done', () => {
    const completions = [{ weekIndex: 3, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-20' }]
    const result = takeableCleanings({ ...base, weeksAhead: 0, completions })
    expect(result.map(({ zone }) => zone)).toEqual(['Bathroom'])
  })

  it('offers the zone to who has it after a takeover, not to who had it before', () => {
    // m1 took the Bathroom of m2: m0 can still take it, from m1, and no longer from m2
    const result = takeableCleanings({
      ...base,
      weeksAhead: 0,
      takeovers: [takeover({ zone: 'Bathroom', takerId: 'm1', fromId: 'm2', debtZone: 'Kitchen' })],
    })
    expect(result).toContainEqual({ weekIndex: 3, zone: 'Bathroom', fromId: 'm1' })
  })

  it('does not offer a zone that the person took already', () => {
    const result = takeableCleanings({ ...base, weeksAhead: 0, takeovers: [takeover()] })
    expect(result.map(({ zone }) => zone)).toEqual(['Bathroom'])
  })
})
