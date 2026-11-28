// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PERSON_COLORS } from '../domain/palette'
import { setLocale } from '../i18n/i18n'
import { ColorPicker } from './ColorPicker'

afterEach(() => setLocale('en'))

const setup = (overrides: Partial<Parameters<typeof ColorPicker>[0]> = {}) => {
  const onChange = vi.fn()
  render(
    <ColorPicker value="#1976d2" takenBy={{}} busy={false} onChange={onChange} {...overrides} />,
  )
  return { onChange }
}

describe('ColorPicker', () => {
  it('offers the colors of the palette in a group, and marks the one that is chosen', () => {
    setup()
    const group = screen.getByRole('group', { name: /your color/i })
    expect(group.querySelectorAll('button')).toHaveLength(PERSON_COLORS.length)
    expect(screen.getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Green' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('reports the color that is picked', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Pink' }))
    expect(onChange).toHaveBeenCalledWith('#c2185b')
  })

  it('does nothing when the color that is already chosen is picked again', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Blue' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not show the colors that somebody else already has: only the free ones', () => {
    setup({ takenBy: { '#388e3c': 'Ben', '#f57c00': 'Carl' } })
    expect(screen.queryByRole('button', { name: /green/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /orange/i })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(PERSON_COLORS.length - 2)
    // The color that the person has is always there, even if it is also somebody else's
    expect(screen.getByRole('button', { name: 'Blue' })).toBeTruthy()
  })

  it('keeps the own color visible when somebody else shares it', () => {
    setup({ takenBy: { '#1976d2': 'Ben' } })
    expect(screen.getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the whole palette when there is no free color left, so nobody is stuck', () => {
    const taken = Object.fromEntries(PERSON_COLORS.slice(1).map((color) => [color.hex, 'Someone']))
    setup({ takenBy: taken })
    expect(screen.getAllByRole('button')).toHaveLength(PERSON_COLORS.length)
  })

  it('cannot be pressed while the change is being saved', () => {
    setup({ busy: true })
    expect((screen.getByRole('button', { name: 'Pink' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('names the colors in the language of the app', () => {
    setLocale('es')
    setup()
    expect(screen.getByRole('button', { name: 'Azul' })).toBeTruthy()
    expect(screen.getByRole('group', { name: /tu color/i })).toBeTruthy()
  })
})
