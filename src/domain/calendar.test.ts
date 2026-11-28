import { describe, expect, it } from 'vitest'
import { buildMonth, shiftMonth } from './calendar'

const completions = [
  { doneAt: '2026-10-13', memberId: 'm0', zone: 'Kitchen' },
  { doneAt: '2026-10-13', memberId: 'm1', zone: 'Bathroom' },
  { doneAt: '2026-10-30', memberId: 'm2', zone: 'Living room' },
]

describe('buildMonth', () => {
  // October 2026 starts on a Thursday and has 31 days
  const october = buildMonth({ year: 2026, month: 9, completions, today: '2026-10-20' })

  it('lays the month out in weeks that start on Monday, with the days around it to fill them', () => {
    expect(october.weeks).toHaveLength(5)
    expect(october.weeks.every((week) => week.length === 7)).toBe(true)
    expect(october.weeks[0][0].date).toBe('2026-09-28')
    expect(october.weeks[0][3].date).toBe('2026-10-01')
    expect(october.weeks[4][6].date).toBe('2026-11-01')
  })

  it('tells which days belong to the month and which are only there to fill the row', () => {
    const days = october.weeks.flat()
    expect(days.filter((day) => day.inMonth)).toHaveLength(31)
    expect(days[0].inMonth).toBe(false)
    expect(days.find((day) => day.date === '2026-10-01')?.inMonth).toBe(true)
  })

  it('marks today, and only today', () => {
    const today = october.weeks.flat().filter((day) => day.isToday)
    expect(today.map((day) => day.date)).toEqual(['2026-10-20'])
  })

  it('puts each cleaning on the day it was done, with who did it and what', () => {
    const day = october.weeks.flat().find((candidate) => candidate.date === '2026-10-13')
    expect(day?.entries).toEqual([
      { memberId: 'm0', zone: 'Kitchen' },
      { memberId: 'm1', zone: 'Bathroom' },
    ])
    expect(
      october.weeks.flat().find((candidate) => candidate.date === '2026-10-14')?.entries,
    ).toEqual([])
  })

  it('does not drop a cleaning done on a day that is only filling the row', () => {
    const november = buildMonth({
      year: 2026,
      month: 10,
      completions: [{ doneAt: '2026-10-30', memberId: 'm2', zone: 'Living room' }],
      today: '2026-11-02',
    })
    const day = november.weeks.flat().find((candidate) => candidate.date === '2026-10-30')
    expect(day?.inMonth).toBe(false)
    expect(day?.entries).toHaveLength(1)
  })

  it('uses exactly the weeks it needs: four for a February that starts on a Monday', () => {
    const february = buildMonth({ year: 2027, month: 1, completions: [], today: '2027-02-10' })
    expect(february.weeks).toHaveLength(4)
    expect(february.weeks[0][0].date).toBe('2027-02-01')
  })

  it('needs six weeks when the month is long and starts late in the week', () => {
    // May 2027 starts on a Saturday and has 31 days
    const may = buildMonth({ year: 2027, month: 4, completions: [], today: '2027-05-10' })
    expect(may.weeks).toHaveLength(6)
  })
})

describe('shiftMonth', () => {
  it('moves forward and back inside a year', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 1)).toEqual({ year: 2026, month: 10 })
    expect(shiftMonth({ year: 2026, month: 9 }, -1)).toEqual({ year: 2026, month: 8 })
  })

  it('crosses the change of year in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})
