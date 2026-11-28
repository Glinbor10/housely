// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildHistory, personStats, weekStartDate, zoneStats } from '../domain/history'
import type { Settlement } from '../domain/settlements'
import type { Takeover } from '../domain/takeovers'
import { HistoryView } from './HistoryView'

const names = { m0: 'Ana', m1: 'Ben' }
const colors = { m0: '#1976d2', m1: '#f57c00' }
// Week 0: Kitchen is Ana's, Bathroom is Ben's. Week 1 (the running one) has the zones swapped.
const layouts = [{ fromWeek: 0, members: ['m0', 'm1'], zones: ['Kitchen', 'Bathroom'] }]
// What a person can take to make up a zone: a cleaning of the housemate, in the running week
const takeable = [{ weekIndex: 1, zone: 'Kitchen', fromId: 'm0', startsOn: '2026-10-19' }]

const setup = ({
  settlements = [] as Settlement[],
  completions = [] as Array<{ weekIndex: number; zone: string; memberId: string; doneAt: string }>,
  currentMemberId = 'm0',
  isOwner = false,
  withSettle = true,
  onSettle = vi.fn().mockResolvedValue(true),
  onUndo = vi.fn(),
  takeovers = [] as Takeover[],
  view = 'calendar' as 'calendar' | 'list',
  rotation = layouts,
} = {}) => {
  const weeks = buildHistory({
    layouts: rotation,
    completions,
    settlements,
    takeovers,
    currentWeek: 1,
    startDate: '2026-10-12',
  })
  render(
    <HistoryView
      weeks={weeks}
      names={names}
      colors={colors}
      currentWeek={1}
      weekStart={(index) => weekStartDate('2026-10-12', index)}
      people={personStats(weeks, 1)}
      zones={zoneStats(weeks, 1)}
      calendarCompletions={[]}
      today="2026-10-28"
      initialView={view}
      settle={
        withSettle
          ? {
              takeable,
              currentMemberId,
              isOwner,
              busy: false,
              error: null,
              onSettle,
              onUndo,
            }
          : undefined
      }
    />,
  )
  return { onSettle, onUndo }
}

describe('HistoryView settling', () => {
  it('offers to settle only the zones that were missed in a finished week', () => {
    setup({
      completions: [{ weekIndex: 0, zone: 'Bathroom', memberId: 'm1', doneAt: '2026-10-14' }],
    })
    // Week 0: Kitchen missed. Bathroom was done. Week 1 is running: its zones are only pending.
    expect(screen.getAllByRole('button', { name: /^settle /i })).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: /settle kitchen of the week of 12 Oct/i }),
    ).toBeTruthy()
  })

  it('lets only who owes a zone settle it: for the zones of others it says who has to', () => {
    // Week 0: Kitchen was Ana's and Bathroom was Ben's. Ben is the one looking.
    setup({ currentMemberId: 'm1' })
    expect(screen.getByRole('button', { name: /settle bathroom of the week of/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /settle kitchen of the week of/i })).toBeNull()
    expect(screen.getByText('Ana has to settle it')).toBeTruthy()
  })

  it('does not let the owner settle the zone of somebody else either', () => {
    setup({ currentMemberId: 'm1', isOwner: true })
    expect(screen.queryByRole('button', { name: /settle kitchen of the week of/i })).toBeNull()
  })

  it('shows nothing to settle when the screen is not given the way to do it', () => {
    setup({ withSettle: false })
    expect(screen.queryByRole('button', { name: /^settle /i })).toBeNull()
  })

  it('opens the form of the zone and sends what was chosen, for that week and zone', async () => {
    const { onSettle } = setup()
    await userEvent.click(
      screen.getByRole('button', { name: /settle kitchen of the week of 12 Oct/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    await userEvent.type(screen.getByLabelText(/note/i), 'Away')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSettle).toHaveBeenCalledWith({
      weekIndex: 0,
      zone: 'Kitchen',
      kind: 'away',
      note: 'Away',
    })
  })

  it('closes the form when it was saved, and keeps it when it failed', async () => {
    const failing = vi.fn().mockResolvedValue(false)
    setup({ onSettle: failing })
    await userEvent.click(
      screen.getByRole('button', { name: /settle kitchen of the week of 12 Oct/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByRole('group', { name: /kitchen, week of 12 Oct/i })).toBeTruthy()
  })

  it('keeps the form of another zone open when a slow save of the first one ends', async () => {
    let finish: (saved: boolean) => void = () => undefined
    const slow = vi.fn().mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)))
    // One person with both zones, so both are theirs to settle
    setup({
      onSettle: slow,
      rotation: [{ fromWeek: 0, members: ['m0'], zones: ['Kitchen', 'Bathroom'] }],
    })
    await userEvent.click(screen.getByRole('button', { name: /settle kitchen of the week of/i }))
    await userEvent.click(screen.getByRole('button', { name: /not at home/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    // The person closes the modal (for example with the back button) and opens the next zone while the
    // first one is still being stored
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: /settle bathroom of the week of/i }))
    finish(true)
    await waitFor(() => expect(slow).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('group', { name: /bathroom, week of/i })).toBeTruthy()
  })

  it('shows how each zone was settled, the note and who settled it', () => {
    setup({
      settlements: [
        {
          weekIndex: 0,
          zone: 'Kitchen',
          kind: 'covered',
          memberId: 'm1',
          coveredBy: 'm1',
          note: 'I had time',
        },
        { weekIndex: 0, zone: 'Bathroom', kind: 'late', memberId: 'm0', doneAt: '2026-10-20' },
      ],
    })
    expect(screen.getByText('Covered by Ben')).toBeTruthy()
    expect(screen.getByText('I had time')).toBeTruthy()
    expect(screen.getByText('Done late 20 Oct')).toBeTruthy()
    expect(screen.getByText('Settled by Ben')).toBeTruthy()
    // A settled zone is not missed any more, so it is not offered again
    expect(screen.queryByRole('button', { name: /^settle /i })).toBeNull()
    expect(screen.queryByText('Missed')).toBeNull()
  })

  it('marks the zones of the person as "Yours" and leaves the ones of others unmarked', () => {
    setup()
    // The kitchen of the first week is Ana's (the person), the bathroom is Ben's
    expect(screen.getAllByText('Yours')).toHaveLength(1)
    const kitchen = screen.getByText('Kitchen', { selector: 'p' }).closest('div')?.parentElement
    expect(kitchen?.textContent).toMatch(/yours/i)
  })

  describe('what comes first on the screen', () => {
    const before = (first: HTMLElement, second: HTMLElement) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

    it('puts the cleanings nobody did above the calendar: they are what a person has to act on', () => {
      setup()
      const missed = screen.getByRole('region', { name: 'Cleanings nobody did' })
      const calendar = screen.getByRole('heading', { name: /october 2026/i })
      expect(before(missed, calendar)).toBe(true)
    })

    it('keeps the settled ones below the calendar, they are only for looking back', () => {
      setup({ settlements: [{ weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0' }] })
      const calendar = screen.getByRole('heading', { name: /october 2026/i })
      const settled = screen.getByRole('region', { name: 'Settled' })
      expect(before(calendar, settled)).toBe(true)
    })

    it('starts with the calendar when there is nothing to settle', () => {
      setup({
        completions: [
          { weekIndex: 0, zone: 'Kitchen', memberId: 'm0', doneAt: '2026-10-14' },
          { weekIndex: 0, zone: 'Bathroom', memberId: 'm1', doneAt: '2026-10-14' },
        ],
      })
      expect(screen.queryByRole('region', { name: 'Cleanings nobody did' })).toBeNull()
      expect(screen.getByRole('heading', { name: /october 2026/i })).toBeTruthy()
    })
  })

  it('does not paint "Yours" in red: red says error, and this only says whose turn it is', () => {
    setup()
    const chip = screen.getByText('Yours').closest('.MuiChip-root')
    expect(chip?.className).not.toContain('MuiChip-colorError')
  })

  it('says how a zone was settled in the line of the zone, not in a pill that wraps', () => {
    setup({ settlements: [{ weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0' }] })
    const how = screen.getByText('Not at home')
    expect(how.closest('.MuiChip-root')).toBeNull()
  })

  it('does not say who settled a zone when it was the person who owed it, only when somebody else did', () => {
    setup({
      settlements: [
        // The kitchen of the first week is Ana's: she settled it herself
        { weekIndex: 0, zone: 'Kitchen', kind: 'late', memberId: 'm0', doneAt: '2026-10-20' },
        // The bathroom is Ben's and Ana recorded it
        { weekIndex: 0, zone: 'Bathroom', kind: 'late', memberId: 'm0', doneAt: '2026-10-21' },
      ],
    })
    expect(screen.getAllByText('Settled by Ana')).toHaveLength(1)
  })

  it('shows a zone settled as not at home', () => {
    setup({ settlements: [{ weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0' }] })
    expect(screen.getByText('Not at home')).toBeTruthy()
  })

  it('lets the author undo it, and the owner, but not somebody else', async () => {
    const settlements: Settlement[] = [
      { weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0' },
    ]
    const { onUndo } = setup({ settlements, currentMemberId: 'm0' })
    await userEvent.click(
      screen.getByRole('button', {
        name: /undo the settlement of kitchen of the week of 12 Oct/i,
      }),
    )
    expect(onUndo).toHaveBeenCalledWith(0, 'Kitchen')
  })

  it('does not offer to undo to somebody who is neither the author nor the owner', () => {
    setup({
      settlements: [{ weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0' }],
      currentMemberId: 'm1',
    })
    expect(screen.queryByRole('button', { name: /undo the settlement/i })).toBeNull()
  })

  it('offers it to the owner even when somebody else settled it', () => {
    setup({
      settlements: [{ weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0' }],
      currentMemberId: 'm1',
      isOwner: true,
    })
    expect(screen.getByRole('button', { name: /undo the settlement/i })).toBeTruthy()
  })

  it('keeps the list as a summary only: no button to settle, no form and no undo', () => {
    setup({
      view: 'list',
      settlements: [{ weekIndex: 0, zone: 'Kitchen', kind: 'away', memberId: 'm0', note: 'Away' }],
      currentMemberId: 'm0',
    })
    expect(screen.getByText('Not at home')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /settle|undo/i })).toBeNull()
    expect(screen.queryByText('Away')).toBeNull()
  })

  describe('making up with another cleaning', () => {
    // Ben did not clean the Bathroom of week 1 (the first one) and takes the Kitchen of Ana of week 2
    const takeover: Takeover = {
      weekIndex: 1,
      zone: 'Kitchen',
      takerId: 'm1',
      fromId: 'm0',
      debtWeek: 0,
      debtZone: 'Bathroom',
    }
    const madeUp: Settlement = {
      weekIndex: 0,
      zone: 'Bathroom',
      kind: 'madeUp',
      memberId: 'm1',
      tookWeek: 1,
      tookZone: 'Kitchen',
    }

    it('shows the debt as made up with the cleaning that was taken', () => {
      setup({ settlements: [madeUp], takeovers: [takeover] })
      expect(screen.getByText('Made up with Kitchen (19 Oct)')).toBeTruthy()
    })

    it('shows on the cleaning that was taken who had it and which debt it settles', () => {
      setup({ settlements: [madeUp], takeovers: [takeover], view: 'list' })
      expect(screen.getByText(/instead of ana: makes up week 12 oct/i)).toBeTruthy()
      // It is Ben's cleaning now
      const week = screen.getByRole('heading', { name: /week 19 oct/i }).closest('div')!
      expect(within(week.parentElement!).getAllByText('Ben').length).toBeGreaterThan(0)
    })

    it('settles a missed zone with a cleaning that the person takes', async () => {
      const { onSettle } = setup({ currentMemberId: 'm1' })
      await userEvent.click(
        screen.getByRole('button', { name: /settle bathroom of the week of 12 Oct/i }),
      )
      await userEvent.click(screen.getByRole('button', { name: /make up with another cleaning/i }))
      // The cleaning is found on the calendar, by the week it is in
      await userEvent.click(screen.getByRole('button', { name: /^october 19$/i }))
      await userEvent.click(
        await screen.findByRole('button', { name: 'Kitchen (Ana)' }, { timeout: 4000 }),
      )
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
      expect(onSettle).toHaveBeenCalledWith({
        kind: 'madeUp',
        tookWeek: 1,
        tookZone: 'Kitchen',
        weekIndex: 0,
        zone: 'Bathroom',
      })
    })

    it('can be undone while the cleaning that was taken is not done', () => {
      setup({ settlements: [madeUp], takeovers: [takeover], currentMemberId: 'm1' })
      expect(
        screen.getByRole('button', {
          name: /undo the settlement of bathroom of the week of 12 Oct/i,
        }),
      ).toBeTruthy()
    })

    it('cannot be undone once the cleaning that was taken is done', () => {
      setup({
        settlements: [madeUp],
        takeovers: [takeover],
        currentMemberId: 'm1',
        completions: [{ weekIndex: 1, zone: 'Kitchen', memberId: 'm1', doneAt: '2026-10-28' }],
      })
      expect(screen.queryByRole('button', { name: /undo the settlement of bathroom/i })).toBeNull()
    })
  })
})
