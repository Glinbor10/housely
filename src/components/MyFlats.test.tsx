// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MyFlats } from './MyFlats'

const flats = [
  { flatId: 'f1', memberId: 'm0', flatName: 'Calle Luna 12' },
  { flatId: 'f2', memberId: 'm2', flatName: 'Beach house' },
]

const renderFlats = (props: Partial<Parameters<typeof MyFlats>[0]> = {}) => {
  const onOpen = vi.fn()
  const onBack = vi.fn()
  render(
    <MyFlats flats={flats} busy={false} error={null} onOpen={onOpen} onBack={onBack} {...props} />,
  )
  return { onOpen, onBack }
}

describe('MyFlats', () => {
  it('lists the flats found for the account and opens the chosen one', async () => {
    const { onOpen } = renderFlats()
    expect(screen.getByRole('button', { name: /calle luna 12/i })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /beach house/i }))
    expect(onOpen).toHaveBeenCalledWith(flats[1])
  })

  it('says it is looking while the flats load', () => {
    renderFlats({ flats: null })
    expect(screen.getByText(/looking for your flats/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /luna/i })).toBeNull()
  })

  it('explains what to do when the account has no flats', () => {
    renderFlats({ flats: [] })
    expect(screen.getByText(/did not find any flat/i)).toBeTruthy()
    expect(screen.getByText(/join with the invite code/i)).toBeTruthy()
  })

  it('shows an error and goes back', async () => {
    const { onBack } = renderFlats({ error: 'Could not load your flats.' })
    expect(screen.getByText('Could not load your flats.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
