import { toIsoDate } from './completions'
import { layoutForWeek, type RotationLayout } from './layouts'
import { getAssignments, getRestingMembers } from './rotation'

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
  doneAt: string | null
}

export interface HistoryWeek {
  weekIndex: number
  // Monday of the week, YYYY-MM-DD
  startsOn: string
  entries: HistoryEntry[]
  // People without a zone that week
  resting: string[]
}

// Monday of the given week of the rotation. Date arithmetic is done on local calendar dates, so
// changes of daylight saving time cannot move a week.
export const weekStartDate = (startDate: string, weekIndex: number): string => {
  const [year, month, day] = startDate.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const mondayOffset = (start.getDay() + 6) % 7
  return toIsoDate(new Date(year, month - 1, day - mondayOffset + weekIndex * 7))
}

interface HistoryInput {
  layouts: RotationLayout[]
  completions: HistoryCompletion[]
  currentWeek: number
  startDate: string
}

// Every week from the start to the current one, newest first. Each week is read with the layout that
// was in force then, so editing people or zones never rewrites the past.
export const buildHistory = ({
  layouts,
  completions,
  currentWeek,
  startDate,
}: HistoryInput): HistoryWeek[] => {
  const weeks: HistoryWeek[] = []
  for (let weekIndex = currentWeek; weekIndex >= 0; weekIndex -= 1) {
    const layout = layoutForWeek(layouts, weekIndex)
    if (layout === undefined) return []
    weeks.push({
      weekIndex,
      startsOn: weekStartDate(startDate, weekIndex),
      entries: getAssignments(layout.members, layout.zones, weekIndex).map(({ zone, member }) => ({
        zone,
        memberId: member,
        doneAt:
          completions.find(
            (completion) => completion.weekIndex === weekIndex && completion.zone === zone,
          )?.doneAt ?? null,
      })),
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

const tally = <TRow>(
  weeks: HistoryWeek[],
  currentWeek: number,
  keyOf: (entry: HistoryEntry) => string,
  build: (key: string, counts: Counts) => TRow,
): TRow[] => {
  const counts = new Map<string, Counts>()
  // Oldest first, so the order is stable: who or what appeared first in the rotation
  for (const week of [...weeks].reverse()) {
    for (const entry of week.entries) {
      const key = keyOf(entry)
      const row = counts.get(key) ?? { assigned: 0, done: 0, missed: 0 }
      row.assigned += 1
      if (entry.doneAt !== null) row.done += 1
      // The current week is still in progress: its pending zones are not missed yet
      else if (week.weekIndex < currentWeek) row.missed += 1
      counts.set(key, row)
    }
  }
  return [...counts].map(([key, row]) => build(key, row))
}

export const personStats = (weeks: HistoryWeek[], currentWeek: number): PersonStats[] =>
  tally(
    weeks,
    currentWeek,
    (entry) => entry.memberId,
    (memberId, row) => ({ memberId, ...row }),
  )

export const zoneStats = (weeks: HistoryWeek[], currentWeek: number): ZoneStats[] =>
  tally(
    weeks,
    currentWeek,
    (entry) => entry.zone,
    (zone, row) => ({ zone, ...row }),
  )
