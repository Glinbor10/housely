// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/i18n'
import { Mascot } from './Mascot'

afterEach(() => setLocale('en'))

describe('Mascot', () => {
  it.each([
    ['sleepy', /sleeping/i],
    ['happy', /smiling/i],
    ['party', /celebrating/i],
    ['worried', /worried/i],
    ['sad', /sad/i],
    ['angry', /angry/i],
  ] as const)('describes its %s mood for screen readers', (mood, label) => {
    render(<Mascot mood={mood} />)
    expect(screen.getByRole('img', { name: label })).toBeTruthy()
  })

  it('describes itself in the language of the app', () => {
    setLocale('es')
    render(<Mascot mood="angry" />)
    expect(screen.getByRole('img', { name: /enfadad/i })).toBeTruthy()
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

  it('turns red when it is angry, and has the feet of the house in every mood', () => {
    const fill = (mood: 'happy' | 'angry') => {
      const { container, unmount } = render(<Mascot mood={mood} />)
      const body = container.querySelector('[data-part="body"]')?.getAttribute('fill')
      const feet = container.querySelectorAll('[data-part="foot"]').length
      unmount()
      return { body, feet }
    }
    const happy = fill('happy')
    const angry = fill('angry')
    expect(angry.body).not.toBe(happy.body)
    expect(happy.feet).toBe(2)
    expect(angry.feet).toBe(2)
  })

  it('has no beak: it is a house, not a bird', () => {
    const { container } = render(<Mascot mood="happy" />)
    expect(container.querySelector('[data-part="beak"]')).toBeNull()
  })

  it('gives every instance its own clip ids, so two angry faces never share an eyelid', () => {
    const { container } = render(
      <>
        <Mascot mood="angry" />
        <Mascot mood="angry" />
      </>,
    )
    const ids = [...container.querySelectorAll('clipPath')].map((node) => node.id)
    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
