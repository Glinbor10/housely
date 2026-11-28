// @vitest-environment jsdom
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
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
      startsOn="2026-10-14"
      assignments={assignments}
      completions={[]}
      currentMember="Ana"
      today="2026-10-16"
      onMarkDone={() => {}}
      onUndoDone={() => {}}
      {...props}
    />,
  )

describe('ThisWeek', () => {
  it('shows who has each zone and highlights the current person', () => {
    renderWeek()
    expect(screen.getByText('Ana (you)')).toBeTruthy()
    expect(screen.getByText('Ben')).toBeTruthy()
  })

  it('keeps the initial readable on the color of each person, light or dark', () => {
    // Orange and green need dark text, blue needs white: the same rule as every other avatar of the app
    renderWeek({
      assignments: [
        { zone: 'Kitchen', member: 'Ana' },
        { zone: 'Bathroom', member: 'Ben' },
        { zone: 'Hall', member: 'Cris' },
      ],
      colors: { Ana: '#1976d2', Ben: '#f57c00', Cris: '#388e3c' },
    })
    expect(getComputedStyle(screen.getByText('A', { selector: '.MuiAvatar-root' })).color).toBe(
      'rgb(255, 255, 255)',
    )
    expect(getComputedStyle(screen.getByText('B', { selector: '.MuiAvatar-root' })).color).toBe(
      'rgb(0, 0, 0)',
    )
    expect(getComputedStyle(screen.getByText('C', { selector: '.MuiAvatar-root' })).color).toBe(
      'rgb(0, 0, 0)',
    )
  })

  it('names each zone with a heading right under the title of the flat, no level skipped', () => {
    renderWeek()
    expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Bathroom' })).toBeTruthy()
  })

  it('gives the text of the mascot bubble room to breathe', () => {
    renderWeek({ mascotBubble: 'Settle your debts!' })
    const style = getComputedStyle(screen.getByTestId('mascot-bubble'))
    // The text used to sit 8 px from the sides and 4 px from the top: too tight to read comfortably
    expect(style.paddingLeft).toBe('12px')
    expect(style.paddingRight).toBe('12px')
    expect(style.paddingTop).toBe('8px')
    expect(style.paddingBottom).toBe('8px')
  })

  it('shows what the mascot says in a bubble, and nothing when it says nothing', () => {
    const { unmount } = renderWeek({ mascotBubble: 'Settle your debts!' })
    expect(screen.getByText('Settle your debts!')).toBeTruthy()
    unmount()
    renderWeek()
    expect(screen.queryByText('Settle your debts!')).toBeNull()
  })

  it('tells the zone the person has next week, and lists every zone when they have more than one', () => {
    const { unmount } = renderWeek({ nextZones: ['Kitchen'] })
    expect(screen.getByText('Your next zone')).toBeTruthy()
    unmount()
    renderWeek({ nextZones: ['Kitchen', 'Terrace'] })
    expect(screen.getByText('Your next zones')).toBeTruthy()
    expect(screen.getAllByText('Kitchen').length).toBeGreaterThan(0)
    expect(screen.getByText('Terrace')).toBeTruthy()
  })

  it('shows two next zones and keeps the rest behind a +n that opens them all', async () => {
    renderWeek({ nextZones: ['Kitchen', 'Terrace', 'Hall'] })
    expect(screen.queryByText('Hall')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Show all your next zones' }))

    expect(await screen.findByText('Hall')).toBeTruthy()
    expect(screen.getByText('+1')).toBeTruthy()
  })

  it('keeps the bubble of the next zones as a layer, so the back button can close it', async () => {
    const onOpenLayer = vi.fn()
    const onCloseLayer = vi.fn()
    const zones = ['Kitchen', 'Terrace', 'Hall']
    const { rerender } = renderWeek({ nextZones: zones, layer: null, onOpenLayer, onCloseLayer })

    await userEvent.click(screen.getByRole('button', { name: 'Show all your next zones' }))
    expect(onOpenLayer).toHaveBeenCalledWith('next-zones')

    rerender(
      <ThisWeek
        weekIndex={2}
        startsOn="2026-10-14"
        assignments={assignments}
        completions={[]}
        currentMember="Ana"
        today="2026-10-16"
        nextZones={zones}
        layer="next-zones"
        onOpenLayer={onOpenLayer}
        onCloseLayer={onCloseLayer}
        onMarkDone={() => {}}
        onUndoDone={() => {}}
      />,
    )
    expect(await screen.findByText('Hall')).toBeTruthy()

    await userEvent.keyboard('{Escape}')
    expect(onCloseLayer).toHaveBeenCalledWith('next-zones')
  })

  it('lets the bubble be pressed when it tells of cleanings to settle, and not otherwise', async () => {
    const onMascotBubble = vi.fn()
    const { unmount } = renderWeek({
      mascotBubble: 'You have 2 cleanings to settle!',
      onMascotBubble,
    })
    await userEvent.click(screen.getByRole('button', { name: /you have 2 cleanings to settle/i }))
    expect(onMascotBubble).toHaveBeenCalledTimes(1)
    unmount()
    renderWeek({ mascotBubble: 'Clean!' })
    expect(screen.queryByRole('button', { name: /clean!/i })).toBeNull()
  })

  it('says clearly that the person rests, with a moon instead of the ring of the week', () => {
    renderWeek({ resting: true, currentMember: 'Carla', mascotBubble: 'You rest this week!' })
    expect(screen.getByRole('img', { name: 'Rest' })).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByText('You rest this week!')).toBeTruthy()
  })

  it('lists the next weeks of the person closed, and opens them on tap', async () => {
    renderWeek({
      upcoming: [
        { startsOn: '2026-10-19', endsOn: '2026-10-25', zones: ['Kitchen', 'Terrace'] },
        { startsOn: '2026-10-26', endsOn: '2026-11-01', zones: [] },
      ],
    })
    const list = screen.getByRole('region', { name: 'Your next weeks' })
    const toggle = screen.getByRole('button', { name: 'Your next weeks' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(list.textContent).not.toContain('19 Oct')
    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(list.textContent).toContain('19 Oct – 25 Oct')
    expect(list.textContent).toContain('Kitchen')
    expect(list.textContent).toContain('Terrace')
    expect(list.textContent).toContain('26 Oct – 1 Nov')
    expect(list.textContent).toContain('You rest')
  })

  it('shows no list of next weeks when there are none', () => {
    renderWeek()
    expect(screen.queryByRole('region', { name: 'Your next weeks' })).toBeNull()
  })

  it('only offers to mark as done the zones of the current person', () => {
    renderWeek()
    expect(screen.getAllByRole('button', { name: /mark as done/i })).toHaveLength(1)
  })

  describe('a zone that is done or not', () => {
    const done = [{ weekIndex: 2, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-14' }]

    it('shows a green tick when it is done and a neutral empty ring when it is not, never the word and the date', () => {
      renderWeek({ completions: done })
      const kitchen = screen.getByRole('img', { name: 'Done 14 Oct' })
      expect(kitchen.getAttribute('data-status')).toBe('done')
      expect(kitchen.querySelector('svg')).not.toBeNull()
      const bathroom = screen.getByRole('img', { name: 'Pending' })
      expect(bathroom.getAttribute('data-status')).toBe('pending')
      // Red says "wrong" or "delete": a zone that is simply still to do must not look like either
      expect(bathroom.querySelector('svg')).toBeNull()
      const style = getComputedStyle(bathroom)
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(style.borderTopColor).not.toBe(getComputedStyle(kitchen).backgroundColor)
      expect(screen.queryByText('Done 14 Oct')).toBeNull()
      expect(screen.queryByText('Pending')).toBeNull()
    })

    it('does not show a date field in the card', () => {
      renderWeek({ completions: done })
      expect(screen.queryByLabelText(/date done/i)).toBeNull()
    })
  })

  describe('when the screen keeps the open layer, so the back button can close it', () => {
    const done = [{ weekIndex: 2, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-14' }]

    it('asks the screen to open the dialog of the date with the pencil, and does not open it itself', async () => {
      const onOpenLayer = vi.fn()
      renderWeek({ completions: done, layer: null, onOpenLayer, onCloseLayer: vi.fn() })
      await userEvent.click(
        screen.getByRole('button', { name: /change the date or undo kitchen/i }),
      )
      expect(onOpenLayer).toHaveBeenCalledWith('date:Kitchen')
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('shows the dialog when the screen says it is open, and asks to close it with Cancel', async () => {
      const onCloseLayer = vi.fn()
      renderWeek({ completions: done, layer: 'date:Kitchen', onOpenLayer: vi.fn(), onCloseLayer })
      expect(screen.getByRole('dialog')).toBeTruthy()
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onCloseLayer).toHaveBeenCalledWith('date:Kitchen')
    })
  })

  describe('correcting a cleaning that is done', () => {
    const done = [{ weekIndex: 2, zone: 'Kitchen', member: 'Ana', doneAt: '2026-10-14' }]
    const doneByBen = [{ weekIndex: 2, zone: 'Bathroom', member: 'Ben', doneAt: '2026-10-14' }]
    const pencil = () => screen.getByRole('button', { name: /change the date or undo kitchen/i })

    it('has a pencil only on a zone that the current person marked as done', () => {
      renderWeek({ completions: [...done, ...doneByBen] })
      expect(screen.getAllByRole('button', { name: /change the date or undo/i })).toHaveLength(1)
    })

    it('has no pencil on a zone that is still pending, or that somebody else did', () => {
      renderWeek()
      expect(screen.queryByRole('button', { name: /change the date or undo/i })).toBeNull()
      renderWeek({ completions: doneByBen })
      expect(screen.queryByRole('button', { name: /change the date or undo/i })).toBeNull()
    })

    it('opens the date of the cleaning in a dialog with the pencil, and closes it with Cancel', async () => {
      renderWeek({ completions: done })
      await userEvent.click(pencil())
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect((screen.getByLabelText('Date done: Kitchen') as HTMLInputElement).value).toBe(
        '2026-10-14',
      )
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
    })

    it('does not open anything when a zone is marked as done: the tick is all that changes', async () => {
      const onMarkDone = vi.fn()
      renderWeek({ onMarkDone })
      await userEvent.click(screen.getByRole('button', { name: /mark as done/i }))
      expect(onMarkDone).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByLabelText(/date done/i)).toBeNull()
    })

    it('lets the person change the date, and closes afterwards', async () => {
      const onMarkDone = vi.fn()
      renderWeek({ completions: done, onMarkDone })
      await userEvent.click(pencil())
      const date = screen.getByLabelText('Date done: Kitchen')
      await userEvent.clear(date)
      await userEvent.type(date, '2026-10-12')
      await userEvent.click(screen.getByRole('button', { name: /update date/i }))
      expect(onMarkDone).toHaveBeenCalledWith({
        weekIndex: 2,
        zone: 'Kitchen',
        member: 'Ana',
        doneAt: '2026-10-12',
      })
      await waitFor(() => expect(screen.queryByLabelText('Date done: Kitchen')).toBeNull())
    })

    it('asks before undoing, and nothing happens if it is given up', async () => {
      const onUndoDone = vi.fn()
      renderWeek({ completions: done, onUndoDone })
      await userEvent.click(pencil())
      await userEvent.click(screen.getByRole('button', { name: /^undo kitchen marked as done$/i }))
      expect(onUndoDone).not.toHaveBeenCalled()
      expect(screen.getByText(/pending again/i)).toBeTruthy()
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onUndoDone).not.toHaveBeenCalled()
      expect(screen.queryByText(/pending again/i)).toBeNull()
      // The dialog is still open: the confirmation was given up, not the whole dialog
      expect(screen.getByRole('dialog')).toBeTruthy()
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
    })

    it('undoes the zone once it is confirmed', async () => {
      const onUndoDone = vi.fn()
      renderWeek({ completions: done, onUndoDone })
      await userEvent.click(pencil())
      await userEvent.click(screen.getByRole('button', { name: /^undo kitchen marked as done$/i }))
      await userEvent.click(screen.getByRole('button', { name: /yes, undo/i }))
      expect(onUndoDone).toHaveBeenCalledWith(2, 'Kitchen')
    })
  })

  it('says who had a zone that was taken, and which week it settles', () => {
    renderWeek({ takenFrom: { Bathroom: { name: 'Carla', startsOn: '2026-10-19' } } })
    expect(screen.getByText('Instead of Carla')).toBeTruthy()
    // It is a week, not a day: from its first day to its last
    expect(screen.getByText('Makes up the week of 19 Oct to 25 Oct')).toBeTruthy()
  })

  it('lets a person with two zones mark each of them', () => {
    renderWeek({
      assignments: [
        { zone: 'Kitchen', member: 'Ana' },
        { zone: 'Bathroom', member: 'Ana' },
      ],
    })
    expect(screen.getAllByRole('button', { name: /mark as done/i })).toHaveLength(2)
  })

  it('shows the mood it is given, so the screen can be angry or sad about the past weeks', () => {
    renderWeek({ mood: 'angry' })
    expect(screen.getByRole('img', { name: /angry/i })).toBeTruthy()
  })

  it('works out a mood from the week when it is not given one', () => {
    renderWeek()
    expect(screen.getByRole('img', { name: /sleeping/i })).toBeTruthy()
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
})
