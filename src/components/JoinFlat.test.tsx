// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JoinFlat } from './JoinFlat'

const candidates = [
  { id: 'm2', name: 'Ben' },
  { id: 'm3', name: 'Carl' },
]

const noop = () => {}

describe('JoinFlat', () => {
  it('asks for the invite code first', async () => {
    const onFind = vi.fn()
    render(
      <JoinFlat
        candidates={null}
        busy={false}
        error={null}
        onFind={onFind}
        onPick={noop}
        onBack={noop}
      />,
    )
    await userEvent.type(screen.getByLabelText('Invite code'), 'abc123')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onFind).toHaveBeenCalledWith('abc123')
  })

  it('does not search with an empty code', async () => {
    const onFind = vi.fn()
    render(
      <JoinFlat
        candidates={null}
        busy={false}
        error={null}
        onFind={onFind}
        onPick={noop}
        onBack={noop}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onFind).not.toHaveBeenCalled()
  })

  it('lets the person pick who they are among the free names', async () => {
    const onPick = vi.fn()
    render(
      <JoinFlat
        candidates={candidates}
        busy={false}
        error={null}
        onFind={noop}
        onPick={onPick}
        onBack={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Ben' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Carl' }))
    expect(onPick).toHaveBeenCalledWith('m3')
  })

  it('explains when every name is already taken', () => {
    render(
      <JoinFlat
        candidates={[]}
        busy={false}
        error={null}
        onFind={noop}
        onPick={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByText(/already taken/i)).toBeTruthy()
  })

  it('shows an error and goes back', async () => {
    const onBack = vi.fn()
    render(
      <JoinFlat
        candidates={null}
        busy={false}
        error="That code does not exist"
        onFind={noop}
        onPick={noop}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('That code does not exist')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('says which flat is being joined', () => {
    render(
      <JoinFlat
        candidates={candidates}
        flatName="Calle Luna 12"
        busy={false}
        error={null}
        onFind={noop}
        onPick={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByText(/calle luna 12/i)).toBeTruthy()
  })
})
