import { describe, expect, it } from 'vitest'
import { getMascotMood, getWeekMood } from './mood'

const base = { done: 0, total: 3, dayInWeek: 0, mine: 0, others: 0, mineThisWeek: 0 }

describe('getWeekMood', () => {
  it('is sleepy when nothing is done yet', () => {
    expect(getWeekMood(0, 3)).toBe('sleepy')
  })

  it('is happy while the week is in progress', () => {
    expect(getWeekMood(1, 3)).toBe('happy')
    expect(getWeekMood(2, 3)).toBe('happy')
  })

  it('celebrates when every zone is done', () => {
    expect(getWeekMood(3, 3)).toBe('party')
  })

  it('is sleepy when there is nothing to do, so an empty week never celebrates', () => {
    expect(getWeekMood(0, 0)).toBe('sleepy')
  })
})

describe('getMascotMood', () => {
  it('sleeps at the start of the week, and is happy once there is progress', () => {
    expect(getMascotMood(base)).toBe('sleepy')
    expect(getMascotMood({ ...base, done: 1 })).toBe('happy')
  })

  it('celebrates a clean week above everything else', () => {
    expect(
      getMascotMood({ ...base, done: 3, mine: 2, others: 1, mineThisWeek: 1, dayInWeek: 6 }),
    ).toBe('party')
  })

  it('never celebrates a week without zones', () => {
    expect(getMascotMood({ ...base, total: 0 })).toBe('sleepy')
  })

  it('worries during the last three days when zones are still pending', () => {
    expect(getMascotMood({ ...base, done: 1, dayInWeek: 3 })).toBe('happy')
    expect(getMascotMood({ ...base, done: 1, dayInWeek: 4 })).toBe('worried')
    expect(getMascotMood({ ...base, done: 1, dayInWeek: 5 })).toBe('worried')
  })

  it('gets angry on the last day when your own zones are still pending', () => {
    expect(getMascotMood({ ...base, done: 1, dayInWeek: 6, mineThisWeek: 1 })).toBe('angry')
  })

  it('only worries on the last day when the pending zones belong to somebody else', () => {
    expect(getMascotMood({ ...base, done: 1, dayInWeek: 6 })).toBe('worried')
  })

  it('is sad for the flat when somebody else left zones undone in a finished week', () => {
    expect(getMascotMood({ ...base, done: 1, others: 1 })).toBe('sad')
  })

  it('is angry only for the person who left their own zones undone', () => {
    expect(getMascotMood({ ...base, done: 1, mine: 1 })).toBe('angry')
  })

  it('is angrier than sad, and sadder than worried', () => {
    expect(getMascotMood({ ...base, mine: 1, others: 2 })).toBe('angry')
    expect(getMascotMood({ ...base, others: 1, dayInWeek: 6 })).toBe('sad')
    expect(getMascotMood({ ...base, mineThisWeek: 1, others: 1, dayInWeek: 6 })).toBe('angry')
  })
})
