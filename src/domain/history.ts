import type { CalendarCompletion } from './calendar'
import { toIsoDate } from './completions'
import { layoutForWeek, type RotationLayout } from './layouts'
import { getAssignments, getRestingMembers } from './rotation'
import type { Settlement } from './settlements'
import { applyTakeovers, type Takeover } from './takeovers'

export interface HistoryCompletion {
  weekIndex: number
  zone: string
  memberId: string
  // Local calendar date, YYYY-MM-DD
  doneAt: string
}

export interface HistoryEntry {
  zone: string
  // The person the rotation gave the zone to that week
  memberId: string
  // The date of the cleaning, when somebody marked it done
  doneAt: string | null
  // How a zone that nobody cleaned was settled afterwards. A cleaning always wins over it.
  settlement?: Settlement
  // Set when somebody took the zone from the person who had it, to settle an earlier week
  takeover?: Takeover
}

export interface HistoryWeek {
  weekIndex: number
  // First day of the week, YYYY-MM-DD
  startsOn: string
  entries: HistoryEntry[]
  // People without a zone that week
  resting: string[]
}

// First day of the given week of the rotation: the flat start date plus whole weeks, so the cycle
// follows the date chosen at creation instead of Monday. Date arithmetic is done on local calendar
// dates, so changes of daylight saving time cannot move a week.
export const weekStartDate = (startDate: string, weekIndex: number): string => {
  const [year, month, day] = startDate.split('-').map(Number)
  return toIsoDate(new Date(year, month - 1, day + weekIndex * 7))
}

// Last day of the given week of the rotation, six days after it starts.
export const weekEndDate = (startDate: string, weekIndex: number): string => {
  const [year, month, day] = startDate.split('-').map(Number)
  return toIsoDate(new Date(year, month - 1, day + weekIndex * 7 + 6))
}

// First day of the week of the rotation that a date falls in, or null before the rotation starts.
// The weeks go from the start date, so they only line up with calendar rows (Monday to Sunday) when the
// flat started on a Monday.
export const rotationWeekStart = (startDate: string, iso: string): string | null => {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [y, m, d] = iso.split('-').map(Number)
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(sy, sm - 1, sd)) / 86_400_000)
  return days < 0 ? null : weekStartDate(startDate, Math.floor(days / 7))
}

// How many past weeks the app loads and shows. Completions and settlements are fetched with the same
// window so the number of Firestore reads stays constant regardless of how long the flat has been active.
export const HISTORY_WINDOW = 26

interface HistoryInput {
  layouts: RotationLayout[]
  completions: HistoryCompletion[]
  settlements?: Settlement[]
  takeovers?: Takeover[]
  currentWeek: number
  startDate: string
}

// The most recent HISTORY_WINDOW weeks, newest first. Each week is read with the layout that was in
// force then, so editing people or zones never rewrites the past.
export const buildHistory = ({
  layouts,
  completions,
  settlements = [],
  takeovers = [],
  currentWeek,
  startDate,
}: HistoryInput): HistoryWeek[] => {
  const weeks: HistoryWeek[] = []
  const fromWeek = Math.max(0, currentWeek - HISTORY_WINDOW)
  for (let weekIndex = currentWeek; weekIndex >= fromWeek; weekIndex -= 1) {
    const layout = layoutForWeek(layouts, weekIndex)
    if (layout === undefined) return []
    weeks.push({
      weekIndex,
      startsOn: weekStartDate(startDate, weekIndex),
      entries: applyTakeovers(
        getAssignments(layout.members, layout.zones, weekIndex),
        takeovers,
        weekIndex,
      ).map(({ zone, member }) => {
        const takeover = takeovers.find(
          (item) => item.weekIndex === weekIndex && item.zone === zone,
        )
        const doneAt =
          completions.find(
            (completion) => completion.weekIndex === weekIndex && completion.zone === zone,
          )?.doneAt ?? null
        const settlement =
          doneAt === null
            ? settlements.find((item) => item.weekIndex === weekIndex && item.zone === zone)
            : undefined
        return {
          zone,
          memberId: member,
          doneAt,
          ...(settlement ? { settlement } : {}),
          ...(takeover ? { takeover } : {}),
        }
      }),
      resting:
        layout.members.length === 0
          ? []
          : getRestingMembers(layout.members, layout.zones, weekIndex),
    })
  }
  return weeks
}

export interface PersonStats {
  memberId: string
  assigned: number
  done: number
  missed: number
}

export interface ZoneStats {
  zone: string
  assigned: number
  done: number
  missed: number
}

interface Counts {
  assigned: number
  done: number
  missed: number
}

// What became of an entry. Settling changes whose it is: a zone done late is still the work of the
// person who had it; one covered by somebody else is the work of whoever covered it; and one that was
// a zone settled as not at the flat counts for nobody.
type Outcome = 'done' | 'late' | 'covered' | 'away' | 'madeUp' | 'missed' | 'pending'

const outcomeOf = (entry: HistoryEntry, weekIndex: number, currentWeek: number): Outcome =>
  entry.doneAt !== null
    ? 'done'
    : entry.settlement
      ? entry.settlement.kind
      : weekIndex < currentWeek
        ? 'missed'
        : // The current week is still in progress: its pending zones are not missed yet
          'pending'

const add = (counts: Map<string, Counts>, key: string, change: Partial<Counts>): void => {
  const row = counts.get(key) ?? { assigned: 0, done: 0, missed: 0 }
  counts.set(key, {
    assigned: row.assigned + (change.assigned ?? 0),
    done: row.done + (change.done ?? 0),
    missed: row.missed + (change.missed ?? 0),
  })
}

// Oldest first, so the order is stable: who or what appeared first in the rotation
const eachEntry = (
  weeks: HistoryWeek[],
  currentWeek: number,
  visit: (entry: HistoryEntry, outcome: Outcome) => void,
): void => {
  for (const week of [...weeks].reverse()) {
    for (const entry of week.entries) visit(entry, outcomeOf(entry, week.weekIndex, currentWeek))
  }
}

export const personStats = (weeks: HistoryWeek[], currentWeek: number): PersonStats[] => {
  const counts = new Map<string, Counts>()
  eachEntry(weeks, currentWeek, (entry, outcome) => {
    if (outcome === 'covered') {
      // Excused for the person who had it; the extra work counts for who covered it
      add(counts, entry.memberId, {})
      if (entry.settlement?.coveredBy)
        add(counts, entry.settlement.coveredBy, { assigned: 1, done: 1 })
    } else if (outcome === 'away' || outcome === 'madeUp') {
      // Excused: the cleaning that makes it up is counted in the week it was taken
      add(counts, entry.memberId, {})
    } else {
      add(counts, entry.memberId, {
        assigned: 1,
        done: outcome === 'done' || outcome === 'late' ? 1 : 0,
        missed: outcome === 'missed' ? 1 : 0,
      })
    }
  })
  return [...counts].map(([memberId, row]) => ({ memberId, ...row }))
}

export const zoneStats = (weeks: HistoryWeek[], currentWeek: number): ZoneStats[] => {
  const counts = new Map<string, Counts>()
  eachEntry(weeks, currentWeek, (entry, outcome) => {
    if (outcome === 'away' || outcome === 'madeUp') add(counts, entry.zone, {})
    else {
      add(counts, entry.zone, {
        assigned: 1,
        done: outcome === 'done' || outcome === 'late' || outcome === 'covered' ? 1 : 0,
        missed: outcome === 'missed' ? 1 : 0,
      })
    }
  })
  return [...counts].map(([zone, row]) => ({ zone, ...row }))
}

export interface MissedCounts {
  mine: number
  others: number
}

// Zones left undone in finished weeks, split between one person and everybody else. The week that is
// running is not counted: there is still time.
export const missedCounts = (
  weeks: HistoryWeek[],
  currentWeek: number,
  memberId: string,
): MissedCounts => {
  const counts = { mine: 0, others: 0 }
  for (const week of weeks) {
    if (week.weekIndex >= currentWeek) continue
    for (const entry of week.entries) {
      if (entry.doneAt !== null || entry.settlement) continue
      if (entry.memberId === memberId) counts.mine += 1
      else counts.others += 1
    }
  }
  return counts
}

// The cleanings that were settled afterwards with the date they were done, as cleanings of the
// calendar: a zone done late belongs to the person who had it, a covered one to who covered it.
export const settledCleanings = (weeks: HistoryWeek[]): CalendarCompletion[] =>
  weeks.flatMap((week) =>
    week.entries.flatMap(({ zone, memberId, settlement }) => {
      if (!settlement?.doneAt) return []
      if (settlement.kind === 'late') return [{ doneAt: settlement.doneAt, memberId, zone }]
      if (settlement.kind === 'covered' && settlement.coveredBy) {
        return [{ doneAt: settlement.doneAt, memberId: settlement.coveredBy, zone }]
      }
      return []
    }),
  )
