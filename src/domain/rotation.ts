export interface Assignment<TMember = string, TZone = string> {
  zone: TZone
  member: TMember
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Days since epoch for the local calendar date, immune to DST shifts.
const toDayNumber = (date: Date): number =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)

// Monday-based day offset: Monday = 0 ... Sunday = 6.
const mondayOffset = (date: Date): number => (date.getDay() + 6) % 7

export const getWeekIndex = (startDate: Date, today: Date): number => {
  const startMonday = toDayNumber(startDate) - mondayOffset(startDate)
  const currentMonday = toDayNumber(today) - mondayOffset(today)
  return Math.max(0, Math.floor((currentMonday - startMonday) / 7))
}

// The assignment is computed, never stored: adding or removing members or zones keeps working.
export const getAssignments = <TMember, TZone>(
  members: TMember[],
  zones: TZone[],
  weekIndex: number,
): Assignment<TMember, TZone>[] =>
  members.length === 0
    ? []
    : zones.map((zone, zoneIndex) => ({
        zone,
        member: members[(weekIndex + zoneIndex) % members.length],
      }))

// People without a zone this week (only possible when there are more people than zones).
// Everybody rests once per cycle, so the work is split evenly.
export const getRestingMembers = <TMember>(
  members: TMember[],
  zones: unknown[],
  weekIndex: number,
): TMember[] => {
  const assigned = new Set(zones.map((_, zoneIndex) => (weekIndex + zoneIndex) % members.length))
  return members.filter((_, memberIndex) => !assigned.has(memberIndex))
}
