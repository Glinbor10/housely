import { describe, expect, it } from 'vitest'
import { buildHistory } from './history'
import { baseLayout, type RotationLayout } from './layouts'
import { planRotationEdit, type RotationEdit } from './rotationEdit'

const members = [
  { id: 'm0', name: 'Ana', order: 0, active: true },
  { id: 'm1', name: 'Ben', order: 1, active: true },
  { id: 'm2', name: 'Carla', order: 2, active: true },
]
const zones = ['Living room', 'Kitchen', 'Bathroom']

const plan = (
  edit: RotationEdit,
  overrides: Partial<Parameters<typeof planRotationEdit>[0]> = {},
) => planRotationEdit({ members, zones, storedLayouts: [], currentWeek: 4, edit, ...overrides })

const okPlan = (edit: RotationEdit, overrides = {}) => {
  const result = plan(edit, overrides)
  if (!result.ok) throw new Error(`unexpected errors: ${result.errors.join(', ')}`)
  return result.plan
}

const keep = members.map(({ id, name }) => ({ id, name }))

describe('planRotationEdit', () => {
  it('starts the new layout next week, so the current week is left alone', () => {
    const result = okPlan({ people: keep, zones })
    expect(result.layouts.at(-1)?.fromWeek).toBe(5)
  })

  it('gives a new person the next free id and puts them last in the rotation', () => {
    const result = okPlan({ people: [...keep, { name: ' Dani ' }], zones })
    expect(result.memberWrites.find((write) => write.isNew)).toEqual({
      id: 'm3',
      name: 'Dani',
      active: true,
      order: 3,
      isNew: true,
    })
    expect(result.layouts.at(-1)?.members).toEqual(['m0', 'm1', 'm2', 'm3'])
  })

  it('never reuses an id, even when someone was removed before', () => {
    const withGap = [...members, { id: 'm3', name: 'Old', order: 3, active: false }]
    const result = okPlan({ people: [...keep, { name: 'Dani' }], zones }, { members: withGap })
    expect(result.memberWrites.find((write) => write.isNew)?.id).toBe('m4')
  })

  it('deactivates a removed person instead of deleting them, so their history stays', () => {
    const result = okPlan({ people: keep.filter((person) => person.id !== 'm1'), zones })
    expect(result.memberWrites.find((write) => write.id === 'm1')).toMatchObject({
      active: false,
      isNew: false,
    })
    expect(result.layouts.at(-1)?.members).toEqual(['m0', 'm2'])
  })

  it('renames a person keeping their id', () => {
    const result = okPlan({
      people: keep.map((person) => (person.id === 'm0' ? { ...person, name: 'Anabel' } : person)),
      zones,
    })
    expect(result.memberWrites.find((write) => write.id === 'm0')).toMatchObject({
      name: 'Anabel',
      active: true,
    })
  })

  it('follows the order of the list as the order of the rotation', () => {
    const result = okPlan({ people: [keep[2], keep[0], keep[1]], zones })
    expect(result.layouts.at(-1)?.members).toEqual(['m2', 'm0', 'm1'])
  })

  it('keeps the flat as it was in a layout from week 0 the first time it is edited', () => {
    const result = okPlan({ people: keep.slice(0, 2), zones: ['Kitchen'] })
    expect(result.layouts[0]).toEqual({ fromWeek: 0, members: ['m0', 'm1', 'm2'], zones })
    expect(result.layouts).toHaveLength(2)
  })

  it('does not add that layout again once the flat has layouts', () => {
    const stored: RotationLayout[] = [{ fromWeek: 0, members: ['m0', 'm1', 'm2'], zones }]
    const result = okPlan({ people: keep, zones: ['Kitchen'] }, { storedLayouts: stored })
    expect(result.layouts).toHaveLength(1)
    expect(result.layouts[0].fromWeek).toBe(5)
  })

  it('remembers the zones in force this week, which stay usable until next week', () => {
    const result = okPlan({ people: keep, zones: ['Kitchen', 'Garden'] })
    expect(result.zones).toEqual(['Kitchen', 'Garden'])
    expect(result.previousZones).toEqual(zones)
  })

  it('cleans the names and ignores blank ones', () => {
    const result = okPlan({
      people: [...keep, { name: '   ' }],
      zones: ['  Kitchen ', ''],
    })
    expect(result.memberWrites.some((write) => write.isNew)).toBe(false)
    expect(result.zones).toEqual(['Kitchen'])
  })

  it.each([
    ['no people', { people: [], zones }, 'members-required'],
    [
      'duplicated people',
      { people: [{ name: 'Ana' }, { name: 'ana' }], zones },
      'members-duplicated',
    ],
    ['no zones', { people: keep, zones: [] }, 'zones-required'],
    ['duplicated zones', { people: keep, zones: ['Kitchen', 'kitchen'] }, 'zones-duplicated'],
    ['zones with a slash', { people: keep, zones: ['A/B'] }, 'zone-name-invalid'],
    [
      'a name that is too long',
      { people: [{ name: 'x'.repeat(41) }], zones },
      'member-name-too-long',
    ],
  ])('rejects %s', (_label, edit, code) => {
    const result = plan(edit)
    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.errors).toContain(code)
  })

  it('rejects more people than ids exist: every person ever added keeps an id', () => {
    const many = Array.from({ length: 19 }, (_, index) => ({
      id: `m${index}`,
      name: `P${index}`,
      order: index,
      active: index < 3,
    }))
    const result = plan(
      { people: [{ id: 'm0', name: 'P0' }, { name: 'New 1' }, { name: 'New 2' }], zones },
      { members: many },
    )
    expect(result.ok ? [] : result.errors).toContain('members-too-many')
  })
})

describe('what an edit does to the history', () => {
  const completions = [
    { weekIndex: 0, zone: 'Living room', memberId: 'm0', doneAt: '2026-10-13' },
    { weekIndex: 2, zone: 'Kitchen', memberId: 'm0', doneAt: '2026-10-28' },
    { weekIndex: 3, zone: 'Bathroom', memberId: 'm0', doneAt: '2026-11-05' },
  ]
  const historyOf = (layouts: RotationLayout[], currentWeek: number) =>
    buildHistory({ layouts, completions, currentWeek, startDate: '2026-10-12' })

  it('leaves every week up to the current one exactly as it was', () => {
    const before = historyOf([baseLayout(members, zones)], 4)
    const result = okPlan({
      people: [keep[2], { name: 'Dani' }, keep[0]],
      zones: ['Kitchen', 'Garden'],
    })
    // Four weeks later the flat is in week 8: the first five weeks must be unchanged
    const after = historyOf(result.layouts, 8)
    expect(after.slice(-5)).toEqual(before)
  })

  it('applies the change from the next week on', () => {
    const result = okPlan({ people: keep.slice(0, 2), zones: ['Kitchen'] })
    const week5 = historyOf(result.layouts, 8).find((week) => week.weekIndex === 5)
    expect(week5?.entries.map((entry) => [entry.zone, entry.memberId])).toEqual([['Kitchen', 'm1']])
  })
})
