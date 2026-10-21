import { describe, expect, it } from 'vitest'
import { buildHistory, personStats, weekStartDate, zoneStats } from './history'
import type { RotationLayout } from './layouts'

const zones = ['Living room', 'Kitchen', 'Bathroom']
const base: RotationLayout = { fromWeek: 0, members: ['m0', 'm1', 'm2'], zones }

describe('weekStartDate', () => {
  it('is the Monday of the week, counting from the Monday of the start date', () => {
    // 2026-10-12 is a Monday
    expect(weekStartDate('2026-10-12', 0)).toBe('2026-10-12')
    expect(weekStartDate('2026-10-12', 2)).toBe('2026-10-26')
  })

  it('moves a start date in the middle of the week back to its Monday', () => {
    // Wednesday 2026-10-14
    expect(weekStartDate('2026-10-14', 0)).toBe('2026-10-12')
    expect(weekStartDate('2026-10-14', 1)).toBe('2026-10-19')
  })

  it('crosses a change of year', () => {
    expect(weekStartDate('2026-12-28', 1)).toBe('2027-01-04')
  })
})

describe('buildHistory', () => {
  const completions = [
    { weekIndex: 0, zone: 'Living room', memberId: 'm0', doneAt: '2026-10-13' },
    { weekIndex: 0, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-15' },
    { weekIndex: 1, zone: 'Living room', memberId: 'm1', doneAt: '2026-10-20' },
  ]
  const history = buildHistory({
    layouts: [base],
    completions,
    currentWeek: 2,
    startDate: '2026-10-12',
  })

  it('has one row per week up to the current one, the newest first', () => {
    expect(history.map((week) => week.weekIndex)).toEqual([2, 1, 0])
    expect(history[0].startsOn).toBe('2026-10-26')
  })

  it('assigns each zone with the rotation of that week', () => {
    expect(history[2].entries.map((entry) => [entry.zone, entry.memberId])).toEqual([
      ['Living room', 'm0'],
      ['Kitchen', 'm1'],
      ['Bathroom', 'm2'],
    ])
    expect(history[1].entries.map((entry) => entry.memberId)).toEqual(['m1', 'm2', 'm0'])
  })

  it('says when each zone was done, and leaves the rest as not done', () => {
    expect(history[2].entries.map((entry) => entry.doneAt)).toEqual([
      '2026-10-13',
      '2026-10-15',
      null,
    ])
    expect(history[0].entries.every((entry) => entry.doneAt === null)).toBe(true)
  })

  it('keeps the past as it was when the rotation changes later', () => {
    const changed = buildHistory({
      layouts: [base, { fromWeek: 2, members: ['m0', 'm1'], zones: ['Kitchen'] }],
      completions,
      currentWeek: 2,
      startDate: '2026-10-12',
    })
    // Weeks 0 and 1 are exactly as before; only week 2 follows the new layout
    expect(changed[2]).toEqual(history[2])
    expect(changed[1]).toEqual(history[1])
    expect(changed[0].entries.map((entry) => entry.zone)).toEqual(['Kitchen'])
  })

  it('lists who rests when there are more people than zones', () => {
    const resting = buildHistory({
      layouts: [{ fromWeek: 0, members: ['m0', 'm1', 'm2', 'm3'], zones: ['Kitchen', 'Bathroom'] }],
      completions: [],
      currentWeek: 0,
      startDate: '2026-10-12',
    })
    expect(resting[0].resting).toEqual(['m2', 'm3'])
  })

  it('is empty without layouts', () => {
    expect(
      buildHistory({ layouts: [], completions: [], currentWeek: 3, startDate: '2026-10-12' }),
    ).toEqual([])
  })
})

describe('statistics', () => {
  const history = buildHistory({
    layouts: [base],
    completions: [
      { weekIndex: 0, zone: 'Living room', memberId: 'm0', doneAt: '2026-10-13' },
      { weekIndex: 0, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-15' },
      { weekIndex: 1, zone: 'Living room', memberId: 'm1', doneAt: '2026-10-20' },
      { weekIndex: 2, zone: 'Bathroom', memberId: 'm1', doneAt: '2026-10-27' },
    ],
    currentWeek: 2,
    startDate: '2026-10-12',
  })

  it('counts, per person, what was assigned, done and missed in finished weeks', () => {
    const stats = Object.fromEntries(personStats(history, 2).map((row) => [row.memberId, row]))
    // m0: week0 living (done), week1 bathroom (missed), week2 kitchen (this week, pending)
    expect(stats.m0).toEqual({ memberId: 'm0', assigned: 3, done: 1, missed: 1 })
    // m1: week0 kitchen (done), week1 living (done), week2 bathroom (done)
    expect(stats.m1).toEqual({ memberId: 'm1', assigned: 3, done: 3, missed: 0 })
  })

  it('never counts the current week as missed: there is still time', () => {
    const stats = Object.fromEntries(personStats(history, 2).map((row) => [row.memberId, row]))
    expect(stats.m0.missed).toBe(1)
    expect(stats.m2.missed).toBe(2)
  })

  it('counts, per zone, how often it was assigned, done and missed', () => {
    const stats = Object.fromEntries(zoneStats(history, 2).map((row) => [row.zone, row]))
    // week 2 is the current one: its pending zone is not missed yet
    expect(stats['Living room']).toEqual({ zone: 'Living room', assigned: 3, done: 2, missed: 0 })
    expect(stats['Bathroom']).toEqual({ zone: 'Bathroom', assigned: 3, done: 1, missed: 2 })
  })
})
