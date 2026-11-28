// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BalanceBars, PaymentFlows } from './ExpenseCharts'

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`
const people = [
  { id: 'm0', name: 'Ana', color: '#1976d2' },
  { id: 'm1', name: 'Ben', color: '#388e3c' },
  { id: 'm2', name: 'Carla', color: '#f57c00' },
]

describe('BalanceBars', () => {
  const net = { m0: -3266, m1: 5785, m2: -2519 }

  it('writes what each person is owed or owes with its sign, so the color is not the only clue', () => {
    render(<BalanceBars people={people} net={net} euros={euros} />)
    expect(screen.getByText('−€32.66')).toBeTruthy()
    expect(screen.getByText('+€57.85')).toBeTruthy()
    expect(screen.getByText('−€25.19')).toBeTruthy()
  })

  it('keeps the sentence for who cannot see the bars', () => {
    render(<BalanceBars people={people} net={net} euros={euros} />)
    expect(screen.getByText('Ana owes €32.66')).toBeTruthy()
    expect(screen.getByText(/Ben is owed €57.85/)).toBeTruthy()
  })
})

describe('PaymentFlows', () => {
  const payments = [
    { from: 'm0', to: 'm1', amountCents: 3266 },
    { from: 'm2', to: 'm1', amountCents: 2519 },
  ]
  const setup = (currentMemberId: string, onPay = vi.fn()) => {
    render(
      <PaymentFlows
        payments={payments}
        currentMemberId={currentMemberId}
        busy={false}
        nameOf={(id) => people.find((person) => person.id === id)?.name ?? '?'}
        colorOf={(id) => people.find((person) => person.id === id)?.color ?? '#000'}
        euros={euros}
        onPay={onPay}
      />,
    )
    return onPay
  }

  // In the sx of MUI a width of 1 means 100%: the hidden sentence then took the whole row, went past the
  // edge of the screen and pushed the bottom bar out of it on the Expenses tab
  it('keeps the hidden sentences one pixel wide, so they never widen the page', () => {
    setup('m0')
    render(<BalanceBars people={people} net={{ m0: -3266, m1: 5785, m2: -2519 }} euros={euros} />)
    for (const sentence of [
      screen.getByText('Ana pays Ben €32.66'),
      screen.getByText('Ana owes €32.66'),
    ]) {
      const style = getComputedStyle(sentence)
      expect(style.width).toBe('1px')
      expect(style.height).toBe('1px')
    }
  })

  it('draws who pays whom and how much, and keeps the sentence', () => {
    setup('m0')
    expect(screen.getByText('€32.66')).toBeTruthy()
    expect(screen.getByText('Ana pays Ben €32.66')).toBeTruthy()
    expect(screen.getByText('Carla pays Ben €25.19')).toBeTruthy()
  })

  it('puts the button to mark a payment as paid inside the row of that payment, and says which one it is', () => {
    setup('m0')
    const row = screen.getByText('Ana pays Ben €32.66').closest('li') as HTMLElement
    // Two buttons that both said "Mark as paid" sounded the same to a screen reader
    expect(
      within(row).getByRole('button', { name: 'Mark as paid: Ana pays Ben €32.66' }),
    ).toBeTruthy()
    const other = screen.getByText('Carla pays Ben €25.19').closest('li') as HTMLElement
    expect(within(other).queryByRole('button')).toBeNull()
  })

  it('lets only the people of a payment mark it as paid', async () => {
    const onPay = setup('m0')
    // Ana is in the first payment only
    const buttons = screen.getAllByRole('button', { name: /mark as paid/i })
    expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0])
    expect(onPay).toHaveBeenCalledWith(payments[0])
  })
})
