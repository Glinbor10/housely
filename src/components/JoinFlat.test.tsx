// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JoinFlat } from './JoinFlat'

const candidates = [
  { id: 'm2', name: 'Ben', color: '#388e3c' },
  { id: 'm3', name: 'Carl', color: '#f57c00' },
]

// What the people who are already in the flat have
const takenBy = { '#1976d2': 'Ana', '#388e3c': 'Ben', '#f57c00': 'Carl' }

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

  it('lets the person pick who they are among the free names, and then asks for a color', async () => {
    const onPick = vi.fn()
    render(
      <JoinFlat
        candidates={candidates}
        takenBy={takenBy}
        busy={false}
        error={null}
        onFind={noop}
        onPick={onPick}
        onBack={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Ben' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Carl' }))
    // Choosing a name does not join yet: the color comes first
    expect(onPick).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: /your color/i })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }))
    // Their own color, if they do not change it
    expect(onPick).toHaveBeenCalledWith('m3', '#f57c00')
  })

  it('only offers the colors that the other people do not have', async () => {
    render(
      <JoinFlat
        candidates={candidates}
        takenBy={takenBy}
        busy={false}
        error={null}
        onFind={noop}
        onPick={noop}
        onBack={noop}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Carl' }))
    expect(screen.queryByRole('button', { name: 'Blue' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Green' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Orange' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('joins with the color that the person chooses', async () => {
    const onPick = vi.fn()
    render(
      <JoinFlat
        candidates={candidates}
        takenBy={takenBy}
        busy={false}
        error={null}
        onFind={noop}
        onPick={onPick}
        onBack={noop}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Carl' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pink' }))
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }))
    expect(onPick).toHaveBeenCalledWith('m3', '#c2185b')
  })

  it('goes back from the colors to the names without joining', async () => {
    const onPick = vi.fn()
    render(
      <JoinFlat
        candidates={candidates}
        takenBy={takenBy}
        busy={false}
        error={null}
        onFind={noop}
        onPick={onPick}
        onBack={noop}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Carl' }))
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByRole('button', { name: 'Ben' })).toBeTruthy()
    expect(onPick).not.toHaveBeenCalled()
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
