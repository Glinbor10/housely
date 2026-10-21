// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomTabs } from './BottomTabs'

describe('BottomTabs', () => {
  it('offers the three sections and marks the current one', () => {
    render(<BottomTabs value="people" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /week/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /people/i }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('button', { name: /flat/i })).toBeTruthy()
  })

  it('reports the section the person picks', async () => {
    const onChange = vi.fn()
    render(<BottomTabs value="week" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /flat/i }))
    expect(onChange).toHaveBeenCalledWith('flat')
  })
})
