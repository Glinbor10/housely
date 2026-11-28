// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('says what is missing and what to do, with the mascot as decoration only', () => {
    render(<EmptyState text="No expenses yet. Add the first one." />)
    expect(screen.getByText('No expenses yet. Add the first one.')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
