import { describe, expect, it } from 'vitest'
import { findCompletion, markDone, toIsoDate, type Completion } from './completions'

describe('toIsoDate', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date('2026-10-16T23:30:00'))).toBe('2026-10-16')
  })
})

describe('markDone', () => {
  const entry: Completion = { weekIndex: 0, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-16' }

  it('adds a completion', () => {
    expect(markDone([], entry)).toEqual([entry])
  })

  it('replaces the completion of the same zone and week instead of duplicating it', () => {
    const corrected = { ...entry, doneAt: '2026-10-15' }
    expect(markDone([entry], corrected)).toEqual([corrected])
  })

  it('keeps completions of other zones and weeks', () => {
    const other: Completion = { weekIndex: 1, zone: 'Kitchen', member: 'Ben', doneAt: '2026-10-23' }
    expect(markDone([other], entry)).toEqual([other, entry])
  })

  it('does not mutate the input list', () => {
    const list: Completion[] = []
    markDone(list, entry)
    expect(list).toEqual([])
  })
})

describe('findCompletion', () => {
  const entry: Completion = { weekIndex: 2, zone: 'Bathroom', member: 'Carl', doneAt: '2026-10-30' }

  it('finds a completion by week and zone', () => {
    expect(findCompletion([entry], 2, 'Bathroom')).toEqual(entry)
  })

  it('returns undefined when nothing matches', () => {
    expect(findCompletion([entry], 2, 'Kitchen')).toBeUndefined()
  })
})
