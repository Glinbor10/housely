import { describe, expect, it } from 'vitest'
import { zoneKind } from './zones'

describe('zoneKind', () => {
  it('recognizes the bathroom, the kitchen and the living room in English and in Spanish', () => {
    expect(['Bathroom', 'Baño', 'Aseo', 'Toilet', 'Main bath'].map(zoneKind)).toEqual(
      Array(5).fill('bathroom'),
    )
    expect(['Kitchen', 'Cocina'].map(zoneKind)).toEqual(['kitchen', 'kitchen'])
    expect(['Living room', 'Salón', 'Salon', 'Sala de estar', 'Comedor'].map(zoneKind)).toEqual(
      Array(5).fill('living'),
    )
  })

  it('does not care about accents or case', () => {
    expect(zoneKind('BAÑO')).toBe('bathroom')
    expect(zoneKind('sAlÓn')).toBe('living')
  })

  it('leaves every other zone as other, even when it has the word room', () => {
    expect(zoneKind('Games room')).toBe('other')
    expect(zoneKind('Terraza')).toBe('other')
    expect(zoneKind('')).toBe('other')
  })
})
