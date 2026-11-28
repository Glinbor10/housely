import { layoutForWeek, type RotationLayout } from './layouts'
import { getAssignments, type Assignment } from './rotation'

// A person who does a zone that a flatmate had, to settle a zone of an earlier week that they did not
// clean. The rotation stays computed: the takeovers are applied on top of it.
export interface Takeover {
  weekIndex: number
  zone: string
  // Who does the zone now
  takerId: string
  // Who had it according to the rotation
  fromId: string
  // The zone of an earlier week that this settles
  debtWeek: number
  debtZone: string
}

// One per zone and week, like a completion, so a zone is taken once
export const takeoverId = (weekIndex: number, zone: string): string => `${weekIndex}_${zone}`

// The zones of a week with the people who really do them: a person can have several, and when they
// have all of them the rest of the flat has none that week.
export const applyTakeovers = (
  assignments: Assignment[],
  takeovers: Takeover[],
  weekIndex: number,
): Assignment[] =>
  assignments.map(({ zone, member }) => {
    const taken = takeovers.find((item) => item.weekIndex === weekIndex && item.zone === zone)
    return { zone, member: taken ? taken.takerId : member }
  })

export interface Takeable {
  weekIndex: number
  zone: string
  // Who has it now
  fromId: string
}

interface TakeableInput {
  layouts: RotationLayout[]
  completions: { weekIndex: number; zone: string }[]
  takeovers: Takeover[]
  currentWeek: number
  // The person who wants to take a zone
  memberId: string
  // How many weeks after the current one are offered
  weeksAhead?: number
}

// The zones of the flatmates that are not done yet, in the current week and in the next ones: those are
// the ones that can be taken. A week that is over is never offered.
export const takeableCleanings = ({
  layouts,
  completions,
  takeovers,
  currentWeek,
  memberId,
  weeksAhead = 8,
}: TakeableInput): Takeable[] => {
  const found: Takeable[] = []
  for (let weekIndex = currentWeek; weekIndex <= currentWeek + weeksAhead; weekIndex += 1) {
    const layout = layoutForWeek(layouts, weekIndex)
    if (layout === undefined) continue
    const assignments = applyTakeovers(
      getAssignments(layout.members, layout.zones, weekIndex),
      takeovers,
      weekIndex,
    )
    for (const { zone, member } of assignments) {
      const done = completions.some((item) => item.weekIndex === weekIndex && item.zone === zone)
      if (!done && member !== memberId) found.push({ weekIndex, zone, fromId: member })
    }
  }
  return found
}
