// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StartWeekPreview } from './StartWeekPreview'

describe('StartWeekPreview', () => {
  it('marks the chosen day as the start and says where week 1 ends and week 2 starts', () => {
    render(<StartWeekPreview value="2026-10-12" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: /October 12$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: /October 13$/ }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    const hint = screen.getByText(/Week 1 runs from/)
    expect(hint.textContent).toContain(
      'Week 1 runs from 12 Oct to 18 Oct. Week 2 starts on 19 Oct.',
    )
    expect([...hint.querySelectorAll('strong')].map((date) => date.textContent)).toEqual([
      '12 Oct',
      '18 Oct',
      '19 Oct',
    ])
  })

  it('chooses the day that is tapped', () => {
    const onChange = vi.fn()
    render(<StartWeekPreview value="2026-10-12" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /October 14$/ }))

    expect(onChange).toHaveBeenCalledWith('2026-10-14')
  })

  it('asks to pick a day while the date is empty', () => {
    render(<StartWeekPreview value="" onChange={() => {}} />)

    expect(screen.getByText('Pick the day the rotation starts.')).toBeTruthy()
  })
})
