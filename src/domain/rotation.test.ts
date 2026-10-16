import { describe, expect, it } from 'vitest'
import { getAssignments, getWeekIndex } from './rotation'

const members = ['Ana', 'Ben', 'Carl']
const zones = ['Living room', 'Kitchen', 'Bathroom']

describe('getWeekIndex', () => {
  const start = new Date('2026-10-12T00:00:00') // Monday

  it('returns 0 during the first week', () => {
    expect(getWeekIndex(start, new Date('2026-10-18T23:59:00'))).toBe(0)
  })

  it('increments every Monday', () => {
    expect(getWeekIndex(start, new Date('2026-10-19T00:00:00'))).toBe(1)
  })

  it('works across year boundaries', () => {
    expect(getWeekIndex(start, new Date('2027-01-04T10:00:00'))).toBe(12)
  })

  it('never returns a negative index before the start date', () => {
    expect(getWeekIndex(start, new Date('2026-10-01T00:00:00'))).toBe(0)
  })
})

describe('getAssignments', () => {
  it('assigns each zone to a different member in week 0', () => {
    expect(getAssignments(members, zones, 0)).toEqual([
      { zone: 'Living room', member: 'Ana' },
      { zone: 'Kitchen', member: 'Ben' },
      { zone: 'Bathroom', member: 'Carl' },
    ])
  })

  it('rotates one position each week', () => {
    expect(getAssignments(members, zones, 1)).toEqual([
      { zone: 'Living room', member: 'Ben' },
      { zone: 'Kitchen', member: 'Carl' },
      { zone: 'Bathroom', member: 'Ana' },
    ])
  })

  it('returns to the initial state after a full cycle', () => {
    expect(getAssignments(members, zones, 3)).toEqual(getAssignments(members, zones, 0))
  })

  it('supports more members than zones', () => {
    const result = getAssignments(['A', 'B', 'C', 'D'], ['Kitchen', 'Bathroom'], 1)
    expect(result).toEqual([
      { zone: 'Kitchen', member: 'B' },
      { zone: 'Bathroom', member: 'C' },
    ])
  })

  it('supports more zones than members', () => {
    const result = getAssignments(['A', 'B'], ['Z1', 'Z2', 'Z3'], 0)
    expect(result.map((a) => a.member)).toEqual(['A', 'B', 'A'])
  })

  it('returns an empty list when there are no members', () => {
    expect(getAssignments([], zones, 0)).toEqual([])
  })
})
