import { describe, expect, it } from 'vitest'
import { contrastRatio, readableOn } from './color'
import { colorForPerson, colorsForPeople, isPaletteColor, PERSON_COLORS } from './palette'

describe('PERSON_COLORS', () => {
  it('has twelve different colors, one for each person a flat can fill with its first guests', () => {
    expect(PERSON_COLORS).toHaveLength(12)
    expect(new Set(PERSON_COLORS.map((color) => color.hex)).size).toBe(12)
    expect(new Set(PERSON_COLORS.map((color) => color.id)).size).toBe(12)
  })

  it('keeps the eight colors that flats already have, in the same order', () => {
    expect(PERSON_COLORS.slice(0, 8).map((color) => color.hex)).toEqual([
      '#1976d2',
      '#388e3c',
      '#f57c00',
      '#7b1fa2',
      '#d32f2f',
      '#0097a7',
      '#5d4037',
      '#455a64',
    ])
  })

  it('is written in lowercase hexadecimal, the form the rules compare against', () => {
    for (const { hex } of PERSON_COLORS) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('always has readable text on each color', () => {
    for (const { hex } of PERSON_COLORS) {
      expect(contrastRatio(hex, readableOn(hex))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('colorForPerson', () => {
  it('gives each person the color of their position, and starts over after the last one', () => {
    expect(colorForPerson(0)).toBe('#1976d2')
    expect(colorForPerson(11)).toBe(PERSON_COLORS[11].hex)
    expect(colorForPerson(12)).toBe('#1976d2')
  })
})

describe('colorsForPeople', () => {
  it('gives each person the color of their place when nobody chose one', () => {
    expect(colorsForPeople(3, 0)).toEqual([colorForPerson(0), colorForPerson(1), colorForPerson(2)])
  })

  it('gives the owner the color they chose and nobody else repeats it', () => {
    const colors = colorsForPeople(3, 1, '#d32f2f')
    expect(colors[1]).toBe('#d32f2f')
    expect(new Set(colors).size).toBe(3)
    // The others keep the order of the palette, without the chosen color
    expect(colors[0]).toBe('#1976d2')
    expect(colors[2]).toBe('#388e3c')
  })

  it('keeps the color of the owner when it is the one they would have had anyway', () => {
    expect(colorsForPeople(3, 0, colorForPerson(0))).toEqual(colorsForPeople(3, 0))
  })

  it('works with more people than colors, repeating only when there is no other way', () => {
    const colors = colorsForPeople(PERSON_COLORS.length + 2, 0, '#d32f2f')
    expect(colors[0]).toBe('#d32f2f')
    expect(colors).toHaveLength(PERSON_COLORS.length + 2)
    expect(colors.every((color) => isPaletteColor(color))).toBe(true)
  })
})

describe('isPaletteColor', () => {
  it('accepts the colors of the palette and nothing else', () => {
    expect(isPaletteColor('#1976d2')).toBe(true)
    expect(isPaletteColor('#123456')).toBe(false)
    expect(isPaletteColor('red')).toBe(false)
  })
})
