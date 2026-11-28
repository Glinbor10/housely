// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ZoneIcon } from './ZoneIcon'

const kindOf = (zone: string) => {
  const { container } = render(<ZoneIcon zone={zone} />)
  return container.querySelector('svg')?.getAttribute('data-zone-kind')
}

describe('ZoneIcon', () => {
  it('has a symbol for the bathroom, the kitchen and the living room, and another for the rest', () => {
    expect(kindOf('Baño')).toBe('bathroom')
    expect(kindOf('Kitchen')).toBe('kitchen')
    expect(kindOf('Living room')).toBe('living')
    expect(kindOf('Terrace')).toBe('other')
  })

  it('is decoration only: hidden from assistive technology', () => {
    const { container } = render(<ZoneIcon zone="Kitchen" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
