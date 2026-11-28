// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/i18n'
import { TakeoverNotices } from './TakeoverNotices'

afterEach(() => setLocale('en'))

describe('TakeoverNotices', () => {
  it('shows nothing when nobody took a cleaning of the person', () => {
    const { container } = render(<TakeoverNotices notices={[]} />)
    expect(container.textContent).toBe('')
  })

  it('tells the person that somebody does their zone instead, and that they do not have to clean it', () => {
    render(
      <TakeoverNotices
        notices={[
          { zone: 'Kitchen', startsOn: '2026-11-09', takerName: 'Ben', current: true },
          { zone: 'Bathroom', startsOn: '2026-11-23', takerName: 'Carla', current: false },
        ]}
      />,
    )
    expect(
      screen.getByText('Ben cleans Kitchen this week instead of you: you do not have to.'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Carla cleans Bathroom in the week of 23 Nov to 29 Nov instead of you: you do not have to.',
      ),
    ).toBeTruthy()
  })

  it('is said in the language of the app', () => {
    setLocale('es')
    render(
      <TakeoverNotices
        notices={[{ zone: 'Cocina', startsOn: '2026-11-09', takerName: 'Ben', current: true }]}
      />,
    )
    expect(screen.getByText(/ben limpia cocina esta semana en tu lugar/i)).toBeTruthy()
  })

  it('shows only a few notices and the rest behind "show more"', async () => {
    const notices = Array.from({ length: 5 }, (_, index) => ({
      zone: `Zone ${index}`,
      startsOn: '2026-11-23',
      takerName: 'Ben',
      current: false,
    }))
    render(<TakeoverNotices notices={notices} />)
    expect(screen.getAllByRole('alert')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: /show 2 more/i }))
    expect(screen.getAllByRole('alert')).toHaveLength(5)
  })
})
