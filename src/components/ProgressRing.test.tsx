// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressRing } from './ProgressRing'

describe('ProgressRing', () => {
  it('exposes the progress to assistive technology', () => {
    render(<ProgressRing done={1} total={3} />)
    const bar = screen.getByRole('progressbar', { name: /progress of the week/i })
    expect(bar.getAttribute('aria-valuenow')).toBe('33')
  })

  it('shows how many zones are done', () => {
    render(<ProgressRing done={2} total={3} />)
    expect(screen.getByText('2/3')).toBeTruthy()
  })

  it('is empty, not broken, when there are no zones', () => {
    render(<ProgressRing done={0} total={0} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })
})
