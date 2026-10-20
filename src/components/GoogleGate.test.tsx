// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GoogleGate } from './GoogleGate'

const renderGate = (props: Partial<Parameters<typeof GoogleGate>[0]> = {}) => {
  const onContinue = vi.fn()
  const onBack = vi.fn()
  render(
    <GoogleGate busy={false} error={null} onContinue={onContinue} onBack={onBack} {...props} />,
  )
  return { onContinue, onBack }
}

describe('GoogleGate', () => {
  it('explains why creating a flat needs Google and that flatmates do not', () => {
    renderGate()
    expect(screen.getByText(/create your flat with google/i)).toBeTruthy()
    expect(screen.getByText(/find it again from any phone/i)).toBeTruthy()
    expect(screen.getByText(/flatmates do not need google/i)).toBeTruthy()
  })

  it('continues with Google', async () => {
    const { onContinue } = renderGate()
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('disables the button while Google is opening', () => {
    renderGate({ busy: true })
    expect(
      (screen.getByRole('button', { name: /opening google/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('shows what went wrong and goes back', async () => {
    const { onBack } = renderGate({ error: 'Your browser blocked the Google window.' })
    expect(screen.getByText(/blocked the google window/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
