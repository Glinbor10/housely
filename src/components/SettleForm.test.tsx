// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../i18n/i18n'
import { SettleForm } from './SettleForm'

afterEach(() => setLocale('en'))

// The cleanings of housemates that can be taken, with the first day of their week
const takeable = [
  { weekIndex: 4, zone: 'Kitchen', fromId: 'm1', startsOn: '2026-11-02' },
  { weekIndex: 4, zone: 'Bathroom', fromId: 'm2', startsOn: '2026-11-02' },
  { weekIndex: 5, zone: 'Living room', fromId: 'm1', startsOn: '2026-11-09' },
]
const names = { m0: 'Ana', m1: 'Ben', m2: 'Carla' }

const setup = (overrides: Partial<Parameters<typeof SettleForm>[0]> = {}) => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <SettleForm
      zone="Kitchen"
      startsOn="2026-10-12"
      today="2026-10-28"
      weekIndex={1}
      takeable={takeable}
      names={names}
      busy={false}
      error={null}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSave, onCancel }
}

describe('SettleForm', () => {
  it('names the zone and the week that is being settled, by its date', () => {
    setup()
    expect(screen.getByRole('group', { name: /kitchen, week of 12 Oct/i })).toBeTruthy()
  })

  it('offers two ways to settle it: making up with another cleaning, and not being at the flat', () => {
    setup()
    // Doing it late is not a way: the zone is made up with another cleaning, not by doing it afterwards
    expect(screen.queryByRole('button', { name: /done late/i })).toBeNull()
    expect(screen.getByRole('button', { name: /make up with another cleaning/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /not at home/i })).toBeTruthy()
    // The old way of covering a zone is not offered any more
    expect(screen.queryByRole('button', { name: /covered by someone/i })).toBeNull()
  })

  it('shows a calendar to pick the week of the cleaning, never a number of week', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    expect(screen.getByText(/press a highlighted week/i)).toBeTruthy()
    expect(screen.queryByText(/week 5/i)).toBeNull()
    // Only the days of the weeks that have something to take can be pressed
    expect(
      (screen.getByRole('button', { name: /^november 3$/i }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(
      (screen.getByRole('button', { name: /^november 12$/i }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(
      (screen.getByRole('button', { name: /^november 17$/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('lists the cleanings of the week that was pressed, with who has them', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    await userEvent.click(screen.getByRole('button', { name: /^november 4$/i }))
    expect(await screen.findByRole('button', { name: 'Kitchen (Ben)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bathroom (Carla)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Living room (Ben)' })).toBeNull()
  })

  it('finds weeks that start in the middle of the week, not only on Mondays', async () => {
    setup({
      takeable: [
        { weekIndex: 4, zone: 'Kitchen', fromId: 'm1', startsOn: '2026-11-04' },
        { weekIndex: 5, zone: 'Living room', fromId: 'm1', startsOn: '2026-11-11' },
      ],
    })
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    // The week starts on Wednesday 4 November and goes to Tuesday 10: the Monday before is not in it
    const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
    expect(button(/^november 2$/i).disabled).toBe(true)
    expect(button(/^november 4$/i).disabled).toBe(false)
    expect(button(/^november 10$/i).disabled).toBe(false)
    await userEvent.click(button(/^november 10$/i))
    expect(await screen.findByRole('button', { name: 'Kitchen (Ben)' })).toBeTruthy()
  })

  it('makes up the zone with the cleaning that is chosen', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    await userEvent.click(screen.getByRole('button', { name: /^november 11$/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Living room (Ben)' }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledWith({
      kind: 'madeUp',
      tookWeek: 5,
      tookZone: 'Living room',
    })
  })

  it('goes step by step: how, which week, which cleaning, and a last look before saving', async () => {
    setup()
    // Step 1: how it is settled
    expect(screen.getByText('How do you settle it?')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    // Step 2: the week, on the calendar; nothing to save yet
    expect(screen.getByText('Step 2 of 4')).toBeTruthy()
    expect(screen.getByText('Pick the week of the cleaning you will do')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^november 4$/i }))
    // Step 3: the cleanings of that week (the week pressed is seen for a moment first)
    expect(await screen.findByText('Step 3 of 4')).toBeTruthy()
    expect(screen.getByText(/cleanings of the week of 2 Nov/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Bathroom (Carla)' }))
    // Step 4: what will happen, and the note
    expect(screen.getByText('Step 4 of 4')).toBeTruthy()
    expect(
      screen.getByText(
        'You will do the Bathroom of Carla, of the week of 2 Nov to 8 Nov, to make up your Kitchen of the week of 12 Oct to 18 Oct.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy()
  })

  it('keeps the week that was pressed highlighted for a moment before the next step', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    await userEvent.click(screen.getByRole('button', { name: /^november 4$/i }))
    // Still on the calendar, with the week chosen: it does not jump at once
    expect(screen.getByText('Step 2 of 4')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^november 4$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(await screen.findByText('Step 3 of 4')).toBeTruthy()
  })

  it('goes back one step at a time, keeping what was chosen', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    await userEvent.click(screen.getByRole('button', { name: /^november 4$/i }))
    await screen.findByText('Step 3 of 4')
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(await screen.findByText('Step 2 of 4')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText('How do you settle it?')).toBeTruthy()
  })

  it('has only two steps when the person was not at home', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    expect(screen.getByText('Step 2 of 2')).toBeTruthy()
    expect(screen.getByText(/as "Not at home"/)).toBeTruthy()
  })

  it('lets the screen keep the step, so the back button of the phone can go back one step', async () => {
    const onDepth = vi.fn()
    const onBack = vi.fn()
    setup({ depth: 0, onDepth, onBack })
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    expect(onDepth).toHaveBeenCalledWith(1)
  })

  it('explains when there is no cleaning of a housemate to take', async () => {
    setup({ takeable: [] })
    await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
    expect(screen.getByText(/no cleanings of your housemates/i)).toBeTruthy()
  })

  it('forgives with only the note, without the spaces around it', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    await userEvent.type(screen.getByLabelText(/note/i), '  He was away  ')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledWith({ kind: 'away', note: 'He was away' })
  })

  it('limits the note and shows how much has been used', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    await userEvent.type(screen.getByLabelText(/note/i), 'Away')
    expect(screen.getByText('4/140')).toBeTruthy()
  })

  it('shows a failed save and cannot be pressed twice', async () => {
    setup({ error: 'Could not save', busy: true })
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    expect(screen.getByText('Could not save')).toBeTruthy()
    expect((screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('goes back to the choice when the back button is pressed', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByRole('button', { name: /not at home/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })

  it('can be cancelled', async () => {
    const { onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
