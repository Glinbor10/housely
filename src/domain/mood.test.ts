import { describe, expect, it } from 'vitest'
import { getWeekMood } from './mood'

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
