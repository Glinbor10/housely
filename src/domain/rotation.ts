export interface Assignment<TMember = string, TZone = string> {
  zone: TZone
  member: TMember
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Days since epoch for the local calendar date, immune to DST shifts.
const toDayNumber = (date: Date): number =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)

// Weeks are counted from the exact start date chosen when creating the flat, not from its Monday.
export const getWeekIndex = (startDate: Date, today: Date): number =>
  Math.max(0, Math.floor((toDayNumber(today) - toDayNumber(startDate)) / 7))

// Day inside the week of the rotation: 0 on the start date, 6 on its last day. Before the start it
// reads as the first day, so the mascot never works with a negative day.
export const getDayInWeek = (startDate: Date, today: Date): number =>
  Math.max(0, Math.min(6, Math.floor((toDayNumber(today) - toDayNumber(startDate)) % 7)))

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
