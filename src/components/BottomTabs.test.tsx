// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomTabs } from './BottomTabs'

describe('BottomTabs', () => {
  it('has four simple sections and marks the current one', () => {
    render(<BottomTabs value="flat" onChange={() => {}} />)
    const names = screen.getAllByRole('button').map((button) => button.textContent)
    expect(names).toEqual(['Week', 'History', 'My flat', 'Settings'])
    expect(screen.getByRole('button', { name: /my flat/i }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('button', { name: /^week$/i }).getAttribute('aria-current')).toBeNull()
  })

  it('reports the section the person picks', async () => {
    const onChange = vi.fn()
    render(<BottomTabs value="week" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onChange).toHaveBeenCalledWith('settings')
  })
})
