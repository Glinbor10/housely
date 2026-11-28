// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomTabs } from './BottomTabs'

describe('BottomTabs', () => {
  it('has five sections and marks the current one', () => {
    render(<BottomTabs value="members" onChange={() => {}} />)
    const names = screen.getAllByRole('button').map((button) => button.textContent)
    expect(names).toEqual(['Week', 'History', 'People', 'Expenses', 'Settings'])
    expect(screen.getByRole('button', { name: /^people$/i }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('button', { name: /^week$/i }).getAttribute('aria-current')).toBeNull()
  })

  it('keeps the name of every section visible, not only the one that is open', () => {
    render(<BottomTabs value="week" onChange={() => {}} />)
    // An icon alone makes people guess what is behind it: the label of the closed sections must show
    for (const name of ['History', 'People', 'Expenses', 'Settings']) {
      expect(getComputedStyle(screen.getByText(name)).opacity).not.toBe('0')
    }
  })

  it('reports the section the person picks', async () => {
    const onChange = vi.fn()
    render(<BottomTabs value="week" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onChange).toHaveBeenCalledWith('settings')
  })

  it('shows how many cleanings wait to be settled as a number on History, and says it', () => {
    render(<BottomTabs value="week" onChange={() => {}} historyCount={2} />)
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'History, 2 cleanings to settle' })).toBeTruthy()
  })

  it('shows no number when nothing waits', () => {
    render(<BottomTabs value="week" onChange={() => {}} historyCount={0} />)
    expect(screen.getByRole('button', { name: /^history$/i })).toBeTruthy()
  })
})
