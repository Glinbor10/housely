import { describe, expect, it } from 'vitest'
import {
  buildHistory,
  missedCounts,
  personStats,
  settledCleanings,
  weekEndDate,
  rotationWeekStart,
  weekStartDate,
  zoneStats,
} from './history'
import type { RotationLayout } from './layouts'

const zones = ['Living room', 'Kitchen', 'Bathroom']
const base: RotationLayout = { fromWeek: 0, members: ['m0', 'm1', 'm2'], zones }

describe('weekStartDate', () => {
  it('counts whole weeks from the start date', () => {
    // 2026-10-12 is a Monday
    expect(weekStartDate('2026-10-12', 0)).toBe('2026-10-12')
    expect(weekStartDate('2026-10-12', 2)).toBe('2026-10-26')
  })

  it('starts on the exact start date, even in the middle of the week', () => {
    // Wednesday 2026-10-14
    expect(weekStartDate('2026-10-14', 0)).toBe('2026-10-14')
    expect(weekStartDate('2026-10-14', 1)).toBe('2026-10-21')
  })

  it('crosses a change of year', () => {
    expect(weekStartDate('2026-12-28', 1)).toBe('2027-01-04')
  })
})

describe('rotationWeekStart', () => {
  it('is the start of the week of the rotation a date falls in, not the Monday', () => {
    // The rotation started on a Wednesday: its weeks run Wednesday to Tuesday
    expect(rotationWeekStart('2026-10-28', '2026-10-28')).toBe('2026-10-28')
    expect(rotationWeekStart('2026-10-28', '2026-11-03')).toBe('2026-10-28')
    expect(rotationWeekStart('2026-10-28', '2026-11-04')).toBe('2026-11-04')
  })

  it('is null before the rotation starts', () => {
    expect(rotationWeekStart('2026-10-28', '2026-10-27')).toBeNull()
  })
})

describe('weekEndDate', () => {
  it('is six days after the week starts', () => {
    expect(weekEndDate('2026-10-12', 0)).toBe('2026-10-18')
    expect(weekEndDate('2026-10-14', 1)).toBe('2026-10-27')
  })

  it('crosses a change of year', () => {
    expect(weekEndDate('2026-12-28', 0)).toBe('2027-01-03')
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

describe('missedCounts', () => {
  const history = buildHistory({
    layouts: [base],
    completions: [
      { weekIndex: 0, zone: 'Living room', memberId: 'm0', doneAt: '2026-10-13' },
      { weekIndex: 1, zone: 'Kitchen', memberId: 'm2', doneAt: '2026-10-21' },
    ],
    currentWeek: 2,
    startDate: '2026-10-12',
  })

  it('counts the zones left undone in finished weeks, split between the person and everybody else', () => {
    // Week 0: Living m0 (done), Kitchen m1 (missed), Bathroom m2 (missed)
    // Week 1: Living m1 (missed), Kitchen m2 (done), Bathroom m0 (missed)
    expect(missedCounts(history, 2, 'm0')).toEqual({ mine: 1, others: 3 })
    expect(missedCounts(history, 2, 'm1')).toEqual({ mine: 2, others: 2 })
  })

  it('does not count the current week: there is still time', () => {
    const onlyCurrent = buildHistory({
      layouts: [base],
      completions: [],
      currentWeek: 0,
      startDate: '2026-10-12',
    })
    expect(missedCounts(onlyCurrent, 0, 'm0')).toEqual({ mine: 0, others: 0 })
  })

  it('is zero when everything was done', () => {
    const clean = buildHistory({
      layouts: [{ fromWeek: 0, members: ['m0'], zones: ['Kitchen'] }],
      completions: [{ weekIndex: 0, zone: 'Kitchen', memberId: 'm0', doneAt: '2026-10-13' }],
      currentWeek: 1,
      startDate: '2026-10-12',
    })
    expect(missedCounts(clean, 1, 'm0')).toEqual({ mine: 0, others: 0 })
  })
})

describe('settlements', () => {
  // Week 0: Living m0, Kitchen m1, Bathroom m2. Week 1: Living m1, Kitchen m2, Bathroom m0.
  // Week 2 (the running one): Living m2, Kitchen m0, Bathroom m1.
  const completions = [
    { weekIndex: 0, zone: 'Living room', memberId: 'm0', doneAt: '2026-10-13' },
    { weekIndex: 1, zone: 'Kitchen', memberId: 'm2', doneAt: '2026-10-21' },
  ]
  const settlements = [
    {
      weekIndex: 0,
      zone: 'Kitchen',
      kind: 'away' as const,
      memberId: 'm0',
      note: 'He was away',
    },
    {
      weekIndex: 0,
      zone: 'Bathroom',
      kind: 'covered' as const,
      memberId: 'm0',
      coveredBy: 'm0',
      doneAt: '2026-10-15',
    },
    {
      weekIndex: 1,
      zone: 'Living room',
      kind: 'late' as const,
      memberId: 'm2',
      doneAt: '2026-10-22',
    },
    // A zone that was done cannot be settled: the cleaning wins
    { weekIndex: 0, zone: 'Living room', kind: 'away' as const, memberId: 'm1' },
  ]
  const history = buildHistory({
    layouts: [base],
    completions,
    settlements,
    currentWeek: 2,
    startDate: '2026-10-12',
  })
  const entry = (weekIndex: number, zone: string) =>
    history
      .find((week) => week.weekIndex === weekIndex)!
      .entries.find((candidate) => candidate.zone === zone)!

  it('attaches to each entry how it was settled, and leaves the done ones alone', () => {
    expect(entry(0, 'Kitchen').settlement?.kind).toBe('away')
    expect(entry(0, 'Kitchen').settlement?.note).toBe('He was away')
    expect(entry(1, 'Living room').settlement?.kind).toBe('late')
    expect(entry(0, 'Living room').settlement).toBeUndefined()
    expect(entry(0, 'Living room').doneAt).toBe('2026-10-13')
    expect(entry(1, 'Bathroom').settlement).toBeUndefined()
  })

  it('counts a zone done late for the person who had it, and a covered one for who covered it', () => {
    const stats = Object.fromEntries(personStats(history, 2).map((row) => [row.memberId, row]))
    // m0: Living (done), Bathroom of week 1 (missed), Kitchen of week 2 (pending) and the Bathroom of week 0 that m0 covered
    expect(stats.m0).toEqual({ memberId: 'm0', assigned: 4, done: 2, missed: 1 })
    // m1: Kitchen of week 0 away (nobody's), Living of week 1 done late, Bathroom of week 2 pending
    expect(stats.m1).toEqual({ memberId: 'm1', assigned: 2, done: 1, missed: 0 })
    // m2: Bathroom of week 0 covered by somebody else (not theirs now), Kitchen done, Living pending
    expect(stats.m2).toEqual({ memberId: 'm2', assigned: 2, done: 1, missed: 0 })
  })

  it('keeps the statistics of the zones: a zone settled as not at home counts for nobody, late and covered are done', () => {
    const stats = Object.fromEntries(zoneStats(history, 2).map((row) => [row.zone, row]))
    expect(stats['Living room']).toEqual({ zone: 'Living room', assigned: 3, done: 2, missed: 0 })
    expect(stats.Kitchen).toEqual({ zone: 'Kitchen', assigned: 2, done: 1, missed: 0 })
    expect(stats.Bathroom).toEqual({ zone: 'Bathroom', assigned: 3, done: 1, missed: 1 })
  })

  it('does not count a settled zone as missed, so the mascot and the week screen ignore it', () => {
    expect(missedCounts(history, 2, 'm0')).toEqual({ mine: 1, others: 0 })
    expect(missedCounts(history, 2, 'm1')).toEqual({ mine: 0, others: 1 })
  })

  it('works the same without settlements', () => {
    const without = buildHistory({
      layouts: [base],
      completions,
      currentWeek: 2,
      startDate: '2026-10-12',
    })
    expect(without[0].entries.every((candidate) => candidate.settlement === undefined)).toBe(true)
  })

  it('turns the cleanings that were settled with a date into cleanings of the calendar, by who did them', () => {
    // Week 0 Bathroom was covered by m0 on the 15th; week 1 Living room, which was m1's, was done late on the 22nd.
    // The one that was away has no cleaning, and the one without a date cannot be placed on a day.
    expect(settledCleanings(history)).toEqual(
      expect.arrayContaining([
        { doneAt: '2026-10-15', memberId: 'm0', zone: 'Bathroom' },
        { doneAt: '2026-10-22', memberId: 'm1', zone: 'Living room' },
      ]),
    )
    expect(settledCleanings(history)).toHaveLength(2)
  })
})

describe('making up with another cleaning', () => {
  // Week 0: m0 Living room, m1 Kitchen, m2 Bathroom. Week 2: m2 Living room, m0 Kitchen, m1 Bathroom.
  // m1 did not clean the Kitchen of week 0, and in week 2 takes the Kitchen of m0 to settle it.
  const takeovers = [
    {
      weekIndex: 2,
      zone: 'Kitchen',
      takerId: 'm1',
      fromId: 'm0',
      debtWeek: 0,
      debtZone: 'Kitchen',
    },
  ]
  const settlements = [
    {
      weekIndex: 0,
      zone: 'Kitchen',
      kind: 'madeUp' as const,
      memberId: 'm1',
      tookWeek: 2,
      tookZone: 'Kitchen',
    },
  ]
  const input = {
    layouts: [base],
    completions: [],
    settlements,
    takeovers,
    currentWeek: 2,
    startDate: '2026-10-12',
  }

  it('gives the zone that was taken to who took it, and remembers who had it and which debt it settles', () => {
    const week = buildHistory(input)[0]
    const kitchen = week.entries.find((entry) => entry.zone === 'Kitchen')
    expect(kitchen?.memberId).toBe('m1')
    expect(kitchen?.takeover).toEqual(takeovers[0])
    // The other zones are as the rotation says
    expect(week.entries.find((entry) => entry.zone === 'Bathroom')?.memberId).toBe('m1')
  })

  it('shows the debt as settled, with the cleaning that settles it', () => {
    const debt = buildHistory(input)[2].entries.find((entry) => entry.zone === 'Kitchen')
    expect(debt?.settlement?.kind).toBe('madeUp')
  })

  it('does not count the settled debt as missed, for anybody', () => {
    const weeks = buildHistory({ ...input, currentWeek: 3 })
    // Week 0's Kitchen is settled; the rest of the finished weeks are what they are
    const before = missedCounts(
      buildHistory({ ...input, settlements: [], currentWeek: 3 }),
      3,
      'm1',
    )
    const after = missedCounts(weeks, 3, 'm1')
    expect(after.mine).toBe(before.mine - 1)
  })

  it('counts the taken cleaning for who does it, and not for who gave it away', () => {
    const weeks = buildHistory({
      ...input,
      completions: [{ weekIndex: 2, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-28' }],
    })
    const stats = personStats(weeks, 2)
    const of = (id: string) => stats.find((row) => row.memberId === id)
    // m0 had the Kitchen of week 2 and does not have it any more
    expect(of('m0')?.assigned).toBe(2)
    // m1: the Kitchen of week 0 is excused, the Kitchen of week 2 is done, and the rest is theirs
    expect(of('m1')?.assigned).toBe(3)
    expect(of('m1')?.done).toBe(1)
  })
})
