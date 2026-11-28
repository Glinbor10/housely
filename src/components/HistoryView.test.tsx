// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildHistory, personStats, zoneStats, weekStartDate } from '../domain/history'
import { HistoryView } from './HistoryView'

const names = { m0: 'Ana', m1: 'Ben', m2: 'Carla' }
const layouts = [{ fromWeek: 0, members: ['m0', 'm1', 'm2'], zones: ['Living room', 'Kitchen'] }]

const colors = { m0: '#1976d2', m1: '#f57c00', m2: '#388e3c' }

const setup = (
  currentWeek: number,
  completions: Parameters<typeof buildHistory>[0]['completions'],
  initialView: 'calendar' | 'list' = 'list',
) => {
  const weeks = buildHistory({ layouts, completions, currentWeek, startDate: '2026-10-12' })
  render(
    <HistoryView
      weeks={weeks}
      names={names}
      colors={colors}
      currentWeek={currentWeek}
      weekStart={(index) => weekStartDate('2026-10-12', index)}
      people={personStats(weeks, currentWeek)}
      zones={zoneStats(weeks, currentWeek)}
      calendarCompletions={completions.map(({ doneAt, memberId, zone }) => ({
        doneAt,
        memberId,
        zone,
      }))}
      today="2026-10-20"
      initialView={initialView}
    />,
  )
}

describe('HistoryView', () => {
  it('summarises each person: what was done and what was missed', () => {
    setup(2, [{ weekIndex: 0, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-14' }])
    // Ana had the living room in week 1 (not done) and has the kitchen now (still pending)
    const ana = screen.getByRole('listitem', { name: 'Ana' })
    expect(within(ana).getByText('0 of 2 done')).toBeTruthy()
    expect(within(ana).getByText('1 missed')).toBeTruthy()
    const ben = screen.getByRole('listitem', { name: 'Ben' })
    expect(within(ben).getByText('1 of 2 done')).toBeTruthy()
  })

  it('lists the weeks newest first, saying what was done, missed or is still pending', () => {
    setup(1, [{ weekIndex: 0, zone: 'Living room', memberId: 'm0', doneAt: '2026-10-13' }])
    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
    expect(headings).toEqual(['Week 19 Oct–25 Oct', 'Week 12 Oct–18 Oct'])
    expect(screen.getByText('Done 13 Oct')).toBeTruthy()
    // Week 1 is over: what was not done is missed. Week 2 is in progress: it is only pending.
    expect(screen.getAllByText('Missed')).toHaveLength(1)
    expect(screen.getAllByText('Pending')).toHaveLength(2)
  })

  it('shows the latest weeks and lets people ask for the older ones', async () => {
    setup(11, [])
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8)
    await userEvent.click(screen.getByRole('button', { name: /show older weeks/i }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12)
    expect(screen.queryByRole('button', { name: /show older weeks/i })).toBeNull()
  })

  it('says who rests in a week', () => {
    setup(0, [])
    expect(screen.getByText('Resting: Carla')).toBeTruthy()
  })

  it('says there is nothing to show without history', () => {
    render(
      <HistoryView
        weeks={[]}
        names={{}}
        colors={{}}
        currentWeek={0}
        weekStart={(index) => weekStartDate('2026-10-12', index)}
        people={[]}
        zones={[]}
        calendarCompletions={[]}
        today="2026-10-20"
      />,
    )
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy()
  })

  it('opens on the calendar, with every cleaning in the color of who did it', () => {
    setup(2, [{ weekIndex: 0, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-14' }], 'calendar')
    expect(screen.getByRole('heading', { name: /october 2026/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /october 14.*Ben \(Kitchen\)/i })).toBeTruthy()
    // The list is not shown until it is asked for
    expect(screen.queryByText('By person')).toBeNull()
  })

  it('switches between the calendar and the list', async () => {
    setup(2, [], 'calendar')
    await userEvent.click(screen.getByRole('button', { name: /^list$/i }))
    expect(screen.getByText('By person')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /october 2026/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^calendar$/i }))
    expect(screen.getByRole('heading', { name: /october 2026/i })).toBeTruthy()
  })

  it('shows the color of each person next to their name in the list', () => {
    setup(2, [])
    const ana = screen.getByRole('listitem', { name: 'Ana' })
    const dot = within(ana).getByTestId('color-dot')
    expect(getComputedStyle(dot).backgroundColor).toBe('rgb(25, 118, 210)')
  })
})
