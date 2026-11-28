import { describe, expect, it } from 'vitest'
import { baseLayout, layoutForWeek, type RotationLayout } from './layouts'

const layout = (fromWeek: number, members: string[], zones: string[] = ['Kitchen']) => ({
  fromWeek,
  members,
  zones,
})

describe('layoutForWeek', () => {
  const layouts: RotationLayout[] = [
    layout(0, ['a', 'b', 'c']),
    layout(5, ['a', 'b']),
    layout(9, ['a']),
  ]

  it('uses the layout that was in force that week, so changes never rewrite the past', () => {
    expect(layoutForWeek(layouts, 0)?.members).toEqual(['a', 'b', 'c'])
    expect(layoutForWeek(layouts, 4)?.members).toEqual(['a', 'b', 'c'])
    expect(layoutForWeek(layouts, 5)?.members).toEqual(['a', 'b'])
    expect(layoutForWeek(layouts, 8)?.members).toEqual(['a', 'b'])
    expect(layoutForWeek(layouts, 9)?.members).toEqual(['a'])
    expect(layoutForWeek(layouts, 500)?.members).toEqual(['a'])
  })

  it('does not depend on the order the layouts are given in', () => {
    expect(layoutForWeek([...layouts].reverse(), 6)?.members).toEqual(['a', 'b'])
  })

  it('falls back to the first layout for a week before it', () => {
    expect(layoutForWeek([layout(3, ['x'])], 1)?.members).toEqual(['x'])
  })

  it('has nothing to say without layouts', () => {
    expect(layoutForWeek([], 2)).toBeUndefined()
  })
})

describe('baseLayout', () => {
  it('lists the active people in rotation order, from week 0', () => {
    const members = [
      { id: 'm2', order: 2, active: true },
      { id: 'm0', order: 0, active: true },
      { id: 'm1', order: 1, active: false },
    ]
    expect(baseLayout(members, ['Kitchen', 'Bathroom'])).toEqual({
      fromWeek: 0,
      members: ['m0', 'm2'],
      zones: ['Kitchen', 'Bathroom'],
    })
  })
})
