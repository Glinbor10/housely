// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstallHint } from './InstallHint'

describe('InstallHint', () => {
  it('explains how to add the app to the home screen and why', () => {
    render(<InstallHint onDismiss={() => {}} />)
    expect(screen.getByText(/add to home screen/i)).toBeTruthy()
    expect(screen.getByText(/share/i)).toBeTruthy()
    expect(screen.getByText(/lose your access/i)).toBeTruthy()
  })

  it('can be dismissed', async () => {
    const onDismiss = vi.fn()
    render(<InstallHint onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
