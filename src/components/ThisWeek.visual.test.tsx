// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThisWeek } from './ThisWeek'

const assignments = [
  { zone: 'Kitchen', member: 'Ana' },
  { zone: 'Bathroom', member: 'Ben' },
  { zone: 'Living room', member: 'Carla' },
]

const renderWeek = (props: Partial<Parameters<typeof ThisWeek>[0]> = {}) =>
  render(
    <ThisWeek
      weekIndex={2}
      assignments={assignments}
      completions={[]}
      currentMember="Ana"
      today="2026-10-16"
      colors={{ Ana: '#1976d2', Ben: '#388e3c', Carla: '#f57c00' }}
      onMarkDone={() => {}}
      {...props}
    />,
  )

describe('ThisWeek progress', () => {
  it('summarizes how many zones are done this week', () => {
    renderWeek({
      completions: [{ weekIndex: 2, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-14' }],
    })
    expect(screen.getByText('1 of 3 zones done this week')).toBeTruthy()
    const bar = screen.getByRole('progressbar', { name: /progress of the week/i })
    expect(bar.getAttribute('aria-valuenow')).toBe('33')
  })

  it('starts at zero and celebrates when everything is done', () => {
    const { unmount } = renderWeek()
    expect(screen.getByText('0 of 3 zones done this week')).toBeTruthy()
    unmount()

    renderWeek({
      completions: assignments.map(({ zone, member }) => ({
        weekIndex: 2,
        zone,
        member,
        doneAt: '2026-10-14',
      })),
    })
    expect(screen.getByText(/everything is clean this week/i)).toBeTruthy()
  })

  it('does not count completions of other weeks', () => {
    renderWeek({
      completions: [{ weekIndex: 1, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-07' }],
    })
    expect(screen.getByText('0 of 3 zones done this week')).toBeTruthy()
  })
})

describe('ThisWeek avatars', () => {
  it('shows the initial of each person in their own color', () => {
    renderWeek()
    const ana = screen.getByText('A')
    const ben = screen.getByText('B')
    expect(getComputedStyle(ana).backgroundColor).toBe('rgb(25, 118, 210)')
    expect(getComputedStyle(ben).backgroundColor).toBe('rgb(56, 142, 60)')
  })

  it('falls back to the brand color for a person without a color', () => {
    renderWeek({ colors: {} })
    expect(getComputedStyle(screen.getByText('A')).backgroundColor).not.toBe('')
  })

  it('keeps the initials out of the accessibility tree: the names already say who it is', () => {
    renderWeek()
    expect(screen.getByText('A').getAttribute('aria-hidden')).toBe('true')
  })
})
