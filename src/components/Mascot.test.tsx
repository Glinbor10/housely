// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Mascot } from './Mascot'

describe('Mascot', () => {
  it.each([
    ['sleepy', /sleeping/i],
    ['happy', /smiling/i],
    ['party', /celebrating/i],
  ] as const)('describes its %s mood for screen readers', (mood, label) => {
    render(<Mascot mood={mood} />)
    expect(screen.getByRole('img', { name: label })).toBeTruthy()
  })

  it('can be decorative when the text next to it already says everything', () => {
    const { container } = render(<Mascot mood="happy" decorative />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('has the requested size', () => {
    const { container } = render(<Mascot mood="happy" size={64} />)
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('64')
  })
})
