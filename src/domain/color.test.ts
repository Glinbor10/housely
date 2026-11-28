import { describe, expect, it } from 'vitest'
import { contrastRatio, readableOn } from './color'

describe('contrastRatio', () => {
  it('is 21 between black and white and 1 for the same color', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })
})

describe('readableOn', () => {
  it('picks white on dark colors and black on light ones', () => {
    expect(readableOn('#1f3a70')).toBe('#ffffff')
    expect(readableOn('#ffd23f')).toBe('#000000')
  })

  it('always reaches the 4.5:1 of WCAG AA for the colors of the people, which are middle tones', () => {
    for (const color of [
      '#1976d2',
      '#388e3c',
      '#f57c00',
      '#8e24aa',
      '#d32f2f',
      '#00838f',
      '#6d4c41',
    ]) {
      expect(contrastRatio(color, readableOn(color))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('accepts the short form of a color', () => {
    expect(readableOn('#fff')).toBe('#000000')
  })
})
