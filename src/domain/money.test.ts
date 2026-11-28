import { describe, expect, it } from 'vitest'
import { formatEuros, MAX_CENTS, parseEuros } from './money'

describe('parseEuros', () => {
  it('reads whole euros and cents with a dot or a comma', () => {
    expect(parseEuros('12')).toBe(1200)
    expect(parseEuros('12.5')).toBe(1250)
    expect(parseEuros('12,50')).toBe(1250)
    expect(parseEuros('0,05')).toBe(5)
    expect(parseEuros('  7,3  ')).toBe(730)
  })

  it('reads thousands separators', () => {
    expect(parseEuros('1.234,56')).toBe(123456)
    expect(parseEuros('1,234.56')).toBe(123456)
    expect(parseEuros('1.234')).toBe(123400)
    expect(parseEuros('12,345')).toBe(1234500)
  })

  it('rejects what is not an amount', () => {
    for (const text of [
      '',
      ' ',
      'abc',
      '12,3456',
      '-5',
      '0',
      '0,00',
      '1,2,3',
      '12 €x',
      '1.234.567',
    ]) {
      expect(parseEuros(text)).toBeNull()
    }
  })

  it('accepts a euro sign, and rejects amounts that are too big', () => {
    expect(parseEuros('12,50 €')).toBe(1250)
    expect(parseEuros(String(MAX_CENTS / 100))).toBe(MAX_CENTS)
    expect(parseEuros(String(MAX_CENTS / 100 + 1))).toBeNull()
  })
})

describe('formatEuros', () => {
  it('writes the amount as euros in the language of the person', () => {
    expect(formatEuros(1250, 'en').replace(/ /g, ' ')).toBe('€12.50')
    expect(formatEuros(1250, 'es').replace(/ /g, ' ')).toBe('12,50 €')
  })

  it('writes negative amounts and zero', () => {
    expect(formatEuros(0, 'en')).toBe('€0.00')
    expect(formatEuros(-500, 'en')).toContain('5.00')
  })
})
