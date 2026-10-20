// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveAccessBanner } from './SaveAccessBanner'

const renderBanner = (props: Partial<Parameters<typeof SaveAccessBanner>[0]> = {}) => {
  const onSave = vi.fn()
  const onDismiss = vi.fn()
  render(
    <SaveAccessBanner busy={false} error={null} onSave={onSave} onDismiss={onDismiss} {...props} />,
  )
  return { onSave, onDismiss }
}

describe('SaveAccessBanner', () => {
  it('invites flatmates to keep their access, saying it is optional', () => {
    renderBanner()
    expect(screen.getByText(/save your access/i)).toBeTruthy()
    expect(screen.getByText(/another phone/i)).toBeTruthy()
  })

  it('links Google', async () => {
    const { onSave } = renderBanner()
    await userEvent.click(screen.getByRole('button', { name: /link google/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('can be dismissed', async () => {
    const { onDismiss } = renderBanner()
    await userEvent.click(screen.getByRole('button', { name: /not now/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows a failure and blocks the button while it works', () => {
    renderBanner({ error: 'No connection.', busy: true })
    expect(screen.getByText('No connection.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /linking/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
