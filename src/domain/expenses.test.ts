import { describe, expect, it } from 'vitest'
import {
  balances,
  settlementPayments,
  splitShares,
  validateExpense,
  type Expense,
} from './expenses'

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  kind: 'expense',
  title: 'Cleaning products',
  amountCents: 3000,
  paidBy: 'm0',
  participants: ['m0', 'm1', 'm2'],
  date: '2026-10-20',
  createdBy: 'm0',
  ...overrides,
})

describe('splitShares', () => {
  it('splits equally when it is exact', () => {
    expect(splitShares(3000, ['m0', 'm1', 'm2'])).toEqual({ m0: 1000, m1: 1000, m2: 1000 })
  })

  it('gives the cents that are left to the first people, so the shares always add up', () => {
    const shares = splitShares(1000, ['m0', 'm1', 'm2'])
    expect(shares).toEqual({ m0: 334, m1: 333, m2: 333 })
    expect(Object.values(shares).reduce((sum, cents) => sum + cents, 0)).toBe(1000)
    expect(splitShares(1, ['m0', 'm1'])).toEqual({ m0: 1, m1: 0 })
  })

  it('works for one person and for nobody', () => {
    expect(splitShares(500, ['m1'])).toEqual({ m1: 500 })
    expect(splitShares(500, [])).toEqual({})
  })
})

describe('balances', () => {
  it('is empty without expenses', () => {
    expect(balances([])).toEqual({})
  })

  it('gives who paid what they are owed and who shares what they owe', () => {
    // m0 paid 30 for the three: m0 is owed 20, m1 and m2 owe 10
    expect(balances([expense()])).toEqual({ m0: 2000, m1: -1000, m2: -1000 })
  })

  it('only counts the people that the expense is split between', () => {
    const result = balances([expense({ amountCents: 1000, participants: ['m1', 'm2'] })])
    expect(result).toEqual({ m0: 1000, m1: -500, m2: -500 })
  })

  it('always adds up to zero, also with cents that do not divide', () => {
    const result = balances([expense({ amountCents: 1000 }), expense({ id: 'e2', paidBy: 'm1' })])
    expect(Object.values(result).reduce((sum, cents) => sum + cents, 0)).toBe(0)
  })

  it('takes a payment into account: the one who pays owes less and the one who receives is owed less', () => {
    const owed = balances([expense()])
    // m1 pays 10 to m0
    const payment = expense({
      id: 'p1',
      kind: 'payment',
      title: 'Payment',
      amountCents: 1000,
      paidBy: 'm1',
      participants: ['m0'],
    })
    expect(balances([expense(), payment])).toEqual({
      m0: owed.m0 - 1000,
      m1: owed.m1 + 1000,
      m2: owed.m2,
    })
  })
})

describe('settlementPayments', () => {
  it('has nothing to pay when everything is settled', () => {
    expect(settlementPayments({ m0: 0, m1: 0 })).toEqual([])
    expect(settlementPayments({})).toEqual([])
  })

  it('makes the people who owe pay the ones who are owed', () => {
    expect(settlementPayments({ m0: 2000, m1: -1000, m2: -1000 })).toEqual([
      { from: 'm1', to: 'm0', amountCents: 1000 },
      { from: 'm2', to: 'm0', amountCents: 1000 },
    ])
  })

  it('uses the fewest payments: the biggest debt against the biggest credit', () => {
    const payments = settlementPayments({ a: 1000, b: 500, c: -900, d: -600 })
    expect(payments).toHaveLength(3)
    // Whoever pays or receives ends up at zero
    const net: Record<string, number> = { a: 1000, b: 500, c: -900, d: -600 }
    for (const { from, to, amountCents } of payments) {
      net[from] += amountCents
      net[to] -= amountCents
    }
    expect(Object.values(net).every((cents) => cents === 0)).toBe(true)
  })

  it('is the same whatever the order of the people', () => {
    expect(settlementPayments({ m1: -1000, m0: 1000 })).toEqual(
      settlementPayments({ m0: 1000, m1: -1000 }),
    )
  })

  it('settles everything after the payments are registered', () => {
    const start = [
      expense({ amountCents: 1001 }),
      expense({ id: 'e2', paidBy: 'm1', amountCents: 250 }),
    ]
    const payments = settlementPayments(balances(start))
    const registered = payments.map(({ from, to, amountCents }, index) =>
      expense({
        id: `p${index}`,
        kind: 'payment',
        title: 'Payment',
        amountCents,
        paidBy: from,
        participants: [to],
      }),
    )
    expect(Object.values(balances([...start, ...registered])).every((cents) => cents === 0)).toBe(
      true,
    )
  })
})

describe('validateExpense', () => {
  it('accepts a normal expense', () => {
    expect(validateExpense(expense())).toEqual([])
  })

  it('needs a title that is not too long', () => {
    expect(validateExpense(expense({ title: '  ' }))).toContain('title-required')
    expect(validateExpense(expense({ title: 'x'.repeat(61) }))).toContain('title-too-long')
  })

  it('needs a positive whole number of cents', () => {
    expect(validateExpense(expense({ amountCents: 0 }))).toContain('amount-invalid')
    expect(validateExpense(expense({ amountCents: -5 }))).toContain('amount-invalid')
    expect(validateExpense(expense({ amountCents: 10.5 }))).toContain('amount-invalid')
  })

  it('needs somebody who paid and at least one person to split it between, without repeating', () => {
    expect(validateExpense(expense({ paidBy: '' }))).toContain('payer-required')
    expect(validateExpense(expense({ participants: [] }))).toContain('participants-required')
    expect(validateExpense(expense({ participants: ['m0', 'm0'] }))).toContain(
      'participants-duplicated',
    )
  })

  it('needs a real date', () => {
    expect(validateExpense(expense({ date: '20/10/2026' }))).toContain('date-invalid')
    expect(validateExpense(expense({ date: '2026-02-30' }))).toContain('date-invalid')
  })

  it('makes a payment go from one person to another, never to the same one', () => {
    const payment = expense({ kind: 'payment', paidBy: 'm1', participants: ['m0'] })
    expect(validateExpense(payment)).toEqual([])
    expect(validateExpense({ ...payment, participants: ['m1'] })).toContain('payment-to-self')
    expect(validateExpense({ ...payment, participants: ['m0', 'm2'] })).toContain(
      'payment-one-person',
    )
  })
})
