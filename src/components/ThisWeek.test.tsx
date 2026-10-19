// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThisWeek } from './ThisWeek'

const assignments = [
  { zone: 'Kitchen', member: 'Ana' },
  { zone: 'Bathroom', member: 'Ben' },
]

const renderWeek = (props: Partial<Parameters<typeof ThisWeek>[0]> = {}) =>
  render(
    <ThisWeek
      weekIndex={2}
      assignments={assignments}
      completions={[]}
      currentMember="Ana"
      today="2026-10-16"
      onMarkDone={() => {}}
      {...props}
    />,
  )

describe('ThisWeek', () => {
  it('shows who has each zone and highlights the current person', () => {
    renderWeek()
    expect(screen.getByText('Ana (you)')).toBeTruthy()
    expect(screen.getByText('Ben')).toBeTruthy()
  })

  it('only offers to mark as done the zones of the current person', () => {
    renderWeek()
    expect(screen.getAllByRole('button', { name: /mark as done/i })).toHaveLength(1)
  })

  it('marks as done with today by default', async () => {
    const onMarkDone = vi.fn()
    renderWeek({ onMarkDone })
    await userEvent.click(screen.getByRole('button', { name: /mark as done/i }))
    expect(onMarkDone).toHaveBeenCalledWith({
      weekIndex: 2,
      zone: 'Kitchen',
      member: 'Ana',
      doneAt: '2026-10-16',
    })
  })

  it('shows the completion date and lets the person correct it', async () => {
    const onMarkDone = vi.fn()
    renderWeek({
      onMarkDone,
      completions: [{ weekIndex: 2, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-14' }],
    })
    expect(screen.getByText('Done 2026-10-14')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /update date/i }))
    expect(onMarkDone).toHaveBeenCalledWith(expect.objectContaining({ zone: 'Kitchen' }))
  })
})
