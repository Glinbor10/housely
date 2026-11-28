// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../i18n/i18n'
import { ExpensesCard } from './ExpensesCard'

afterEach(() => setLocale('en'))

const setup = (overrides: Partial<Parameters<typeof ExpensesCard>[0]> = {}) => {
  const onOpen = vi.fn()
  render(<ExpensesCard loaded hasExpenses balanceCents={0} onOpen={onOpen} {...overrides} />)
  return { onOpen }
}

describe('ExpensesCard', () => {
  it('opens the expenses', async () => {
    const { onOpen } = setup()
    await userEvent.click(screen.getByRole('button', { name: /expenses/i }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('invites to add the first expense when there are none', () => {
    setup({ hasExpenses: false })
    expect(screen.getByText(/add the first expense/i)).toBeTruthy()
  })

  it('says how much the person is owed, how much they owe, or that all is settled', () => {
    setup({ balanceCents: 2050 })
    expect(screen.getByText('You are owed €20.50')).toBeTruthy()
  })

  it('says how much the person owes', () => {
    setup({ balanceCents: -700 })
    expect(screen.getByText('You owe €7.00')).toBeTruthy()
  })

  it('says that all is settled', () => {
    setup({ balanceCents: 0 })
    expect(screen.getByText(/all settled/i)).toBeTruthy()
  })

  it('is said in Spanish with euros the way they are written there', () => {
    setLocale('es')
    setup({ balanceCents: -700 })
    expect(screen.getByText(/debes 7,00/i)).toBeTruthy()
  })
})
