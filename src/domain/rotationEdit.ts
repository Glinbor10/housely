import { cleanText, MAX_ITEMS, validateDraft } from './flat'
import { baseLayout, layoutForWeek, type RotationLayout } from './layouts'

interface CurrentMember {
  id: string
  name: string
  order: number
  active: boolean
}

export interface PersonEdit {
  // Missing for a person who is being added
  id?: string
  name: string
}

// What the owner asks for: the people in rotation order and the zones.
export interface RotationEdit {
  people: PersonEdit[]
  zones: string[]
}

export interface MemberWrite {
  id: string
  name: string
  active: boolean
  order: number
  isNew: boolean
}

// Everything that has to be written, so the screen and the database stay out of the decisions.
export interface RotationPlan {
  memberWrites: MemberWrite[]
  // Layouts to store: the flat as it was (the first time) and the new one, from next week
  layouts: RotationLayout[]
  // The zones of the flat from now on
  zones: string[]
  // The zones in force this week: still valid to mark until the new layout starts
  previousZones: string[]
}

export type RotationPlanResult = { ok: true; plan: RotationPlan } | { ok: false; errors: string[] }

interface PlanInput {
  members: CurrentMember[]
  zones: string[]
  storedLayouts: RotationLayout[]
  edit: RotationEdit
  currentWeek: number
}

export const planRotationEdit = ({
  members,
  zones,
  storedLayouts,
  edit,
  currentWeek,
}: PlanInput): RotationPlanResult => {
  const known = new Set(members.map((member) => member.id))
  const people = edit.people
    .map((person) => ({
      // An id that does not belong to this flat is treated as a new person
      id: person.id !== undefined && known.has(person.id) ? person.id : undefined,
      name: cleanText(person.name),
    }))
    .filter((person) => person.name !== '')
  const newZones = edit.zones.map(cleanText).filter(Boolean)

  // The same limits and codes as creating a flat
  const errors = validateDraft({
    name: 'flat',
    members: people.map((person) => person.name),
    zones: newZones,
    startDate: '2026-01-01',
  })
  const added = people.filter((person) => person.id === undefined).length
  if (members.length + added > MAX_ITEMS) errors.push('members-too-many')
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] }

  // The flat as it was in force until now, to be kept in the history
  const inForce = storedLayouts.length > 0 ? storedLayouts : [baseLayout(members, zones)]

  let nextOrder = Math.max(-1, ...members.map((member) => member.order)) + 1
  const listed = new Set(people.flatMap((person) => (person.id === undefined ? [] : [person.id])))
  const writes: MemberWrite[] = []
  const ids: string[] = []
  for (const person of people) {
    if (person.id === undefined) {
      const order = nextOrder
      nextOrder += 1
      writes.push({ id: `m${order}`, name: person.name, active: true, order, isNew: true })
      ids.push(`m${order}`)
    } else {
      const current = members.find((member) => member.id === person.id)!
      writes.push({
        id: current.id,
        name: person.name,
        active: true,
        order: current.order,
        isNew: false,
      })
      ids.push(current.id)
    }
  }
  // Whoever is not listed any more stays in the flat, inactive: their past weeks keep their name
  for (const member of members) {
    if (!listed.has(member.id) && member.active) {
      writes.push({ ...member, active: false, isNew: false })
    }
  }

  return {
    ok: true,
    plan: {
      memberWrites: writes,
      layouts: [
        ...(storedLayouts.length > 0 ? [] : inForce),
        { fromWeek: currentWeek + 1, members: ids, zones: newZones },
      ],
      zones: newZones,
      previousZones: layoutForWeek(inForce, currentWeek)?.zones ?? zones,
    },
  }
}
