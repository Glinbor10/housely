// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MembersList } from './MembersList'

const members = [
  { id: 'm1', name: 'Ana', claimed: true },
  { id: 'm2', name: 'Ben', claimed: true },
  { id: 'm3', name: 'Carl', claimed: false },
]

const renderList = (props: Partial<Parameters<typeof MembersList>[0]> = {}) => {
  const onRelease = vi.fn()
  render(
    <MembersList
      members={members}
      currentMemberId="m1"
      canManage
      busy={false}
      error={null}
      onRelease={onRelease}
      {...props}
    />,
  )
  return { onRelease }
}

describe('MembersList', () => {
  it('shows every person and whether they have joined', () => {
    renderList()
    expect(screen.getByText('Ana (you)')).toBeTruthy()
    expect(screen.getByText('Ben')).toBeTruthy()
    expect(screen.getByText(/waiting for carl to join/i)).toBeTruthy()
  })

  it('lets the owner release a person who has joined, but not themselves or people who have not joined', () => {
    renderList()
    expect(screen.getAllByRole('button', { name: /release/i })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /release ben/i })).toBeTruthy()
  })

  it('offers nothing to people who are not the owner', () => {
    renderList({ canManage: false })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('asks for confirmation and explains what happens before releasing', async () => {
    const { onRelease } = renderList()
    await userEvent.click(screen.getByRole('button', { name: /release ben/i }))
    expect(screen.getByText(/lose access/i)).toBeTruthy()
    expect(onRelease).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /yes, release/i }))
    expect(onRelease).toHaveBeenCalledWith('m2')
  })

  it('can cancel the confirmation', async () => {
    const { onRelease } = renderList()
    await userEvent.click(screen.getByRole('button', { name: /release ben/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onRelease).not.toHaveBeenCalled()
    expect(screen.queryByText(/lose access/i)).toBeNull()
  })

  it('shows a failed release', () => {
    renderList({ error: 'Could not release' })
    expect(screen.getByText('Could not release')).toBeTruthy()
  })
})
