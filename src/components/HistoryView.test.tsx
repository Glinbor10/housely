// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildHistory, personStats, zoneStats } from '../domain/history'
import { HistoryView } from './HistoryView'

const names = { m0: 'Ana', m1: 'Ben', m2: 'Carla' }
const layouts = [{ fromWeek: 0, members: ['m0', 'm1', 'm2'], zones: ['Living room', 'Kitchen'] }]

const setup = (
  currentWeek: number,
  completions: Parameters<typeof buildHistory>[0]['completions'],
) => {
  const weeks = buildHistory({ layouts, completions, currentWeek, startDate: '2026-10-12' })
  render(
    <HistoryView
      weeks={weeks}
      names={names}
      currentWeek={currentWeek}
      people={personStats(weeks, currentWeek)}
      zones={zoneStats(weeks, currentWeek)}
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
    expect(headings).toEqual(['Week 2 · from 2026-10-19', 'Week 1 · from 2026-10-12'])
    expect(screen.getByText('Done 2026-10-13')).toBeTruthy()
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
    render(<HistoryView weeks={[]} names={{}} currentWeek={0} people={[]} zones={[]} />)
    expect(screen.getByText(/nothing to show yet/i)).toBeTruthy()
  })
})
