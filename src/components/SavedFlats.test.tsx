// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SavedFlats } from './SavedFlats'

const flats = [
  { flatId: 'f1', name: 'Calle Tarfia' },
  { flatId: 'f2', name: 'Beach house' },
]

describe('SavedFlats', () => {
  it('shows nothing when the device has no flats', () => {
    const { container } = render(<SavedFlats flats={[]} currentFlatId={null} onOpen={vi.fn()} />)
    expect(container.textContent).toBe('')
  })

  it('lists the flats of the device and opens the one that is tapped', async () => {
    const onOpen = vi.fn()
    render(<SavedFlats flats={flats} currentFlatId="f1" onOpen={onOpen} />)
    expect(screen.getByRole('heading', { name: /your homes/i })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Open Beach house' }))
    expect(onOpen).toHaveBeenCalledWith('f2')
  })

  it('marks the flat that is open now', () => {
    render(<SavedFlats flats={flats} currentFlatId="f1" onOpen={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Open Calle Tarfia' }).getAttribute('aria-current'),
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: 'Open Beach house' }).getAttribute('aria-current'),
    ).toBeNull()
  })
})
