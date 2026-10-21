// What the rotation looked like from a given week on. The assignment of a week is computed from the
// layout in force that week, so editing people or zones only affects the weeks that come after.
export interface RotationLayout {
  fromWeek: number
  // Ids of the people in rotation order
  members: string[]
  zones: string[]
}

interface MemberLike {
  id: string
  order: number
  active: boolean
}

// The layout in force during a week: the latest one that started on or before it.
export const layoutForWeek = (
  layouts: RotationLayout[],
  weekIndex: number,
): RotationLayout | undefined => {
  const sorted = [...layouts].sort((a, b) => a.fromWeek - b.fromWeek)
  return sorted.filter((candidate) => candidate.fromWeek <= weekIndex).at(-1) ?? sorted[0]
}

// A flat that never edited its rotation has a single implicit layout: its current people and zones.
export const baseLayout = (members: MemberLike[], zones: string[]): RotationLayout => ({
  fromWeek: 0,
  members: members
    .filter((member) => member.active)
    .sort((a, b) => a.order - b.order)
    .map((member) => member.id),
  zones,
})
