// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/i18n'
import { MonthCalendar } from './MonthCalendar'

afterEach(() => setLocale('en'))

const people = {
  m0: { name: 'Ana', color: '#1976d2' },
  m1: { name: 'Ben', color: '#f57c00' },
  m2: { name: 'Carla', color: '#388e3c' },
}
const completions = [
  { doneAt: '2026-10-13', memberId: 'm0', zone: 'Kitchen' },
  { doneAt: '2026-10-13', memberId: 'm1', zone: 'Bathroom' },
  { doneAt: '2026-10-30', memberId: 'm2', zone: 'Living room' },
]

const setup = (list = completions) =>
  render(<MonthCalendar completions={list} people={people} today="2026-10-20" />)

describe('MonthCalendar', () => {
  it('opens on the month of today', () => {
    setup()
    expect(screen.getByRole('heading', { name: /october 2026/i })).toBeTruthy()
  })

  it('keeps the name of the month on one line, also with the longest names on a narrow phone', () => {
    setup()
    const title = getComputedStyle(screen.getByRole('heading', { name: /october 2026/i }))
    // "Noviembre de 2026" used to break in two lines at 360 px: the month and the year read as two things
    expect(title.whiteSpace).toBe('nowrap')
  })

  it('shades the week of the cleaning cycle of today, which can start on any day, not the calendar row', () => {
    // The rotation started on Wednesday 14: today (Tuesday 20) is in the week from 14 to 20
    render(
      <MonthCalendar
        completions={[]}
        people={people}
        today="2026-10-20"
        rotationStart="2026-10-14"
      />,
    )
    const shaded = (name: RegExp) => {
      const cell = screen.getByRole('button', { name }).parentElement as HTMLElement
      return getComputedStyle(cell).backgroundColor !== 'rgba(0, 0, 0, 0)'
    }
    // Oct 13 is before the rotation start, so no band at all
    expect(shaded(/october 13$/i)).toBe(false)
    // Oct 14–20 is the current rotation week: shaded
    expect(shaded(/october 14$/i)).toBe(true)
    expect(shaded(/october 20$/i)).toBe(true)
    // Oct 21 starts a new rotation week: alternating tint (still shaded, but a different shade)
    expect(shaded(/october 21$/i)).toBe(true)
  })

  it('does not say that nothing was cleaned on a day that has not come yet', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /october 25/i }))
    expect(screen.getByText('That day has not come yet.')).toBeTruthy()
    expect(screen.queryByText(/nothing was cleaned/i)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /october 19/i }))
    expect(screen.getByText(/nothing was cleaned/i)).toBeTruthy()
  })

  it('rounds the shading only where the cleaning week begins and ends, not at the edges of a row', () => {
    // The week goes from Wednesday 14 to Tuesday 20: it continues from Sunday 18 to Monday 19
    render(
      <MonthCalendar
        completions={[]}
        people={people}
        today="2026-10-20"
        rotationStart="2026-10-14"
      />,
    )
    const cell = (name: RegExp) => screen.getByRole('button', { name }).parentElement as HTMLElement
    const radius = (name: RegExp, corner: 'borderTopLeftRadius' | 'borderTopRightRadius') =>
      parseInt(getComputedStyle(cell(name))[corner] || '0', 10)
    expect(radius(/october 14$/i, 'borderTopLeftRadius')).toBeGreaterThan(0)
    expect(radius(/october 18$/i, 'borderTopRightRadius')).toBe(0)
    expect(radius(/october 19$/i, 'borderTopLeftRadius')).toBe(0)
    expect(radius(/october 20$/i, 'borderTopRightRadius')).toBeGreaterThan(0)
  })

  it('starts the week on Monday', () => {
    setup()
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent)
    expect(headers).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('shows, on the day it was done, the initial of each person in their own color', () => {
    setup()
    const day = screen.getByRole('button', { name: /october 13/i })
    const ana = within(day).getByText('A')
    const ben = within(day).getByText('B')
    expect(getComputedStyle(ana).backgroundColor).toBe('rgb(25, 118, 210)')
    expect(getComputedStyle(ben).backgroundColor).toBe('rgb(245, 124, 0)')
  })

  it('names who cleaned what in the label of the day, for screen readers', () => {
    setup()
    const day = screen.getByRole('button', { name: /october 13/i })
    expect(day.getAttribute('aria-label')).toMatch(/Ana \(Kitchen\)/)
    expect(day.getAttribute('aria-label')).toMatch(/Ben \(Bathroom\)/)
  })

  it('has readable text on every color: black on the light ones, white on the dark ones', () => {
    setup()
    const day = screen.getByRole('button', { name: /october 13/i })
    // Blue is a dark enough color for white, orange needs black
    expect(getComputedStyle(within(day).getByText('A')).color).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(within(day).getByText('B')).color).toBe('rgb(0, 0, 0)')
  })

  it('shows the detail of a day when it is tapped', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /october 13/i }))
    const detail = screen.getByRole('region', { name: /october 13/i })
    expect(within(detail).getByText('Ana · Kitchen')).toBeTruthy()
    expect(within(detail).getByText('Ben · Bathroom')).toBeTruthy()
  })

  it('says so when nothing was cleaned that day', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /october 14/i }))
    expect(screen.getByText(/nothing was cleaned this day/i)).toBeTruthy()
  })

  it('does not draw more than three people in a day, and counts the rest', () => {
    setup([
      ...completions,
      { doneAt: '2026-10-13', memberId: 'm2', zone: 'Living room' },
      { doneAt: '2026-10-13', memberId: 'm0', zone: 'Hall' },
    ])
    const day = screen.getByRole('button', { name: /october 13/i })
    expect(within(day).getByText('+1')).toBeTruthy()
  })

  it('moves between months and comes back to today', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByRole('heading', { name: /november 2026/i })).toBeTruthy()
    // A cleaning of October 30 still shows in the filling days of the next month
    expect(screen.getByRole('button', { name: /october 30/i })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    expect(screen.getByRole('heading', { name: /september 2026/i })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.getByRole('heading', { name: /october 2026/i })).toBeTruthy()
  })

  it('has a legend with the color of each person', () => {
    setup()
    const legend = screen.getByRole('list', { name: /people/i })
    expect(within(legend).getByText('Ana')).toBeTruthy()
    expect(within(legend).getByText('Carla')).toBeTruthy()
  })

  it('speaks Spanish: month and days of the week', () => {
    setLocale('es')
    setup()
    expect(screen.getByRole('heading', { name: /octubre de 2026/i })).toBeTruthy()
    expect(screen.getAllByRole('columnheader')[0].textContent?.toLowerCase()).toContain('lun')
  })
})
