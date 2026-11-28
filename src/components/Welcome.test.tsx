// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Welcome } from './Welcome'

describe('Welcome', () => {
  it('offers to create a home or join one', async () => {
    const onCreate = vi.fn()
    const onJoin = vi.fn()
    render(<Welcome onCreate={onCreate} onJoin={onJoin} onSignIn={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /create a home/i }))
    await userEvent.click(screen.getByRole('button', { name: /join a home/i }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onJoin).toHaveBeenCalledTimes(1)
  })

  it('welcomes with the mascot of the app', () => {
    render(<Welcome onCreate={() => {}} onJoin={() => {}} onSignIn={() => {}} />)
    expect(screen.getByRole('img', { name: /housy the mascot/i })).toBeTruthy()
  })

  it('lets people sign in with Google to find their flats', async () => {
    const onSignIn = vi.fn()
    render(<Welcome onCreate={() => {}} onJoin={() => {}} onSignIn={onSignIn} />)
    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('does not ask to sign in with Google when the person already has it linked', () => {
    render(<Welcome onCreate={() => {}} onJoin={() => {}} onSignIn={() => {}} showSignIn={false} />)
    expect(screen.queryByRole('button', { name: /sign in with google/i })).toBeNull()
  })

  it('says in three short lines what the app does', () => {
    render(<Welcome onCreate={() => {}} onJoin={() => {}} onSignIn={() => {}} />)
    expect(screen.getByText('Every week, a zone for every person')).toBeTruthy()
    expect(screen.getByText('Shared expenses, clear accounts')).toBeTruthy()
    expect(screen.getByText('No accounts needed: join with a code')).toBeTruthy()
  })

  it('is shorter when the person already has homes: no pitch, only the way to create or join', () => {
    render(<Welcome onCreate={() => {}} onJoin={() => {}} onSignIn={() => {}} compact />)
    expect(screen.queryByText('Every week, a zone for every person')).toBeNull()
    expect(screen.getByRole('button', { name: /create a home/i })).toBeTruthy()
  })
})
