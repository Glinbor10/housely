import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { MASCOT_LINES, pickMascotLine, type MascotCase } from './mascotLines'

const CASES = Object.keys(MASCOT_LINES) as MascotCase[]
const LINES_PER_CASE = 5

describe('the lines of the mascot', () => {
  it.each(CASES)('has several lines for %s, with the original one first', (kind) => {
    const lines = MASCOT_LINES[kind]
    expect(lines).toHaveLength(LINES_PER_CASE)
    expect(lines[0]).toBe(`mascot.say.${kind}`)
    expect(new Set(lines).size).toBe(lines.length)
  })

  it.each(CASES)('has every %s line written in both languages, and none repeated', (kind) => {
    for (const dictionary of [en, es]) {
      const texts = MASCOT_LINES[kind].map((key) => dictionary[key])
      expect(texts.every((text) => text.trim().length > 0)).toBe(true)
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  it('tells the number of cleanings in every line of the plural debts, and in none of the single one', () => {
    for (const dictionary of [en, es]) {
      expect(MASCOT_LINES.angryDebts.every((key) => dictionary[key].includes('{n}'))).toBe(true)
      expect(MASCOT_LINES.angryDebtsOne.some((key) => dictionary[key].includes('{n}'))).toBe(false)
    }
  })
})

describe('picking the line of the mascot', () => {
  const base = { speechCase: 'worried' as const, resting: false, debts: 0, seed: 0 }

  it('picks the line of the day: the same all day and a different one the next day', () => {
    expect(pickMascotLine({ ...base, seed: 9 })).toBe(pickMascotLine({ ...base, seed: 9 }))
    const week = Array.from({ length: LINES_PER_CASE }, (_, day) =>
      pickMascotLine({ ...base, seed: 7 + day }),
    )
    expect(new Set(week).size).toBe(LINES_PER_CASE)
  })

  it('comes back to the first line once all of them have been told', () => {
    expect(pickMascotLine({ ...base, seed: LINES_PER_CASE })).toBe('mascot.say.worried')
  })

  it.each(['party', 'worried', 'angryWeek'] as const)('picks a line of %s', (speechCase) => {
    expect(MASCOT_LINES[speechCase]).toContain(pickMascotLine({ ...base, speechCase, seed: 3 }))
  })

  it('tells the debts by number, with the single form when there is only one', () => {
    const many = pickMascotLine({ ...base, speechCase: 'angryDebts', debts: 3, seed: 2 })
    const one = pickMascotLine({ ...base, speechCase: 'angryDebts', debts: 1, seed: 2 })
    expect(MASCOT_LINES.angryDebts).toContain(many)
    expect(MASCOT_LINES.angryDebtsOne).toContain(one)
  })

  it('tells of the rest when the person rests and has nothing to settle', () => {
    expect(MASCOT_LINES.rest).toContain(
      pickMascotLine({ ...base, speechCase: 'worried', resting: true, seed: 4 }),
    )
    expect(MASCOT_LINES.rest).toContain(
      pickMascotLine({ ...base, speechCase: undefined, resting: true, seed: 4 }),
    )
  })

  it('tells of the debts before the rest', () => {
    expect(
      MASCOT_LINES.angryDebts.includes(
        pickMascotLine({ ...base, speechCase: 'angryDebts', resting: true, debts: 2 })!,
      ),
    ).toBe(true)
  })

  it('says nothing when the mascot has nothing to tell', () => {
    expect(pickMascotLine({ ...base, speechCase: undefined })).toBeUndefined()
  })
})
