// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Welcome } from './Welcome'

describe('Welcome', () => {
  it('offers to create a flat or join one', async () => {
    const onCreate = vi.fn()
    const onJoin = vi.fn()
    render(<Welcome onCreate={onCreate} onJoin={onJoin} />)
    await userEvent.click(screen.getByRole('button', { name: /create a flat/i }))
    await userEvent.click(screen.getByRole('button', { name: /join a flat/i }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onJoin).toHaveBeenCalledTimes(1)
  })

  it('shows the logo of the app', () => {
    render(<Welcome onCreate={() => {}} onJoin={() => {}} />)
    const logo = screen.getByRole('img', { name: /housely logo/i })
    expect(logo.getAttribute('src')).toBe('/logo.svg')
  })
})
