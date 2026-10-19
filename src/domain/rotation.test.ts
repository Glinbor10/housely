import { describe, expect, it } from 'vitest'
import { getAssignments, getRestingMembers, getWeekIndex } from './rotation'

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

describe('fairness', () => {
  const names = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => `${prefix}${index}`)

  // Every zone goes through every person, so a full cycle of n weeks is perfectly even.
  it.each([1, 2, 3, 4, 5, 6, 7])(
    'with %i people, over a full cycle everyone cleans every zone exactly once',
    (peopleCount) => {
      for (let zoneCount = 1; zoneCount <= 7; zoneCount += 1) {
        const people = names(peopleCount, 'P')
        const zoneList = names(zoneCount, 'Z')
        const seen = new Map<string, number>()
        for (let week = 0; week < peopleCount; week += 1) {
          getAssignments(people, zoneList, week).forEach(({ zone, member }) => {
            const key = `${member}|${zone}`
            seen.set(key, (seen.get(key) ?? 0) + 1)
          })
        }
        expect(seen.size).toBe(peopleCount * zoneCount)
        expect([...seen.values()].every((times) => times === 1)).toBe(true)
      }
    },
  )

  it('splits the work evenly when there are fewer zones than people', () => {
    const people = names(4, 'P')
    const zoneList = names(3, 'Z')
    const cleanings = new Map<string, number>()
    for (let week = 0; week < 4; week += 1) {
      getAssignments(people, zoneList, week).forEach(({ member }) => {
        cleanings.set(member, (cleanings.get(member) ?? 0) + 1)
      })
    }
    expect([...cleanings.values()]).toEqual([3, 3, 3, 3])
  })
})

describe('getRestingMembers', () => {
  it('returns the people without a zone this week when there are more people than zones', () => {
    const people = ['Ana', 'Ben', 'Carl', 'Dana']
    const zoneList = ['Kitchen', 'Bathroom', 'Living room']
    expect(getRestingMembers(people, zoneList, 0)).toEqual(['Dana'])
    expect(getRestingMembers(people, zoneList, 1)).toEqual(['Ana'])
    expect(getRestingMembers(people, zoneList, 2)).toEqual(['Ben'])
    expect(getRestingMembers(people, zoneList, 3)).toEqual(['Carl'])
  })

  it('rests everybody once per cycle', () => {
    const people = ['Ana', 'Ben', 'Carl', 'Dana']
    const zoneList = ['Kitchen', 'Bathroom', 'Living room']
    const rested = [0, 1, 2, 3].flatMap((week) => getRestingMembers(people, zoneList, week))
    expect([...rested].sort()).toEqual([...people].sort())
  })

  it('is empty when every person has at least one zone', () => {
    expect(getRestingMembers(['Ana', 'Ben'], ['A', 'B', 'C'], 0)).toEqual([])
    expect(getRestingMembers(['Ana', 'Ben', 'Carl'], ['A', 'B', 'C'], 5)).toEqual([])
  })

  it('is empty without people', () => {
    expect(getRestingMembers([], ['A'], 0)).toEqual([])
  })
})
