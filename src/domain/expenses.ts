import { MAX_CENTS } from './money'

// An expense of the flat, or a payment between two people. A payment is an expense that one person
// paid and that is split with only one other person, which is exactly what it does to the balances.
export interface Expense {
  id: string
  kind: 'expense' | 'payment'
  title: string
  // Whole cents
  amountCents: number
  // Who paid it
  paidBy: string
  // Who it is split between (for a payment, the one who receives it)
  participants: string[]
  // Local calendar date, YYYY-MM-DD
  date: string
  // Who wrote it: the only one who can change or delete it
  createdBy: string
}

export const MAX_TITLE = 60
export const MAX_PEOPLE = 20

// Equal shares that always add up to the amount: the cents that do not divide go one by one to the first
// people of the list, so everybody works out the same shares.
export const splitShares = (
  amountCents: number,
  participants: string[],
): Record<string, number> => {
  const count = participants.length
  if (count === 0) return {}
  const base = Math.floor(amountCents / count)
  const extra = amountCents - base * count
  return Object.fromEntries(
    participants.map((person, index) => [person, base + (index < extra ? 1 : 0)]),
  )
}

// What each person is owed (positive) or owes (negative), in cents. Everything adds up to zero.
export const balances = (expenses: Expense[]): Record<string, number> => {
  const result: Record<string, number> = {}
  const add = (person: string, cents: number) => {
    result[person] = (result[person] ?? 0) + cents
  }
  for (const expense of expenses) {
    add(expense.paidBy, expense.amountCents)
    for (const [person, share] of Object.entries(
      splitShares(expense.amountCents, expense.participants),
    )) {
      add(person, -share)
    }
  }
  return result
}

export interface Payment {
  from: string
  to: string
  amountCents: number
}

// The fewest payments that leave everybody at zero: the person who owes the most pays the one who is
// owed the most, until nothing is left. People are ordered by amount and then by id, so the result does
// not depend on the order they come in.
export const settlementPayments = (net: Record<string, number>): Payment[] => {
  const ordered = (sign: 1 | -1) =>
    Object.entries(net)
      .filter(([, cents]) => cents * sign > 0)
      .map(([person, cents]) => ({ person, cents: cents * sign }))
      .sort((a, b) => b.cents - a.cents || a.person.localeCompare(b.person))
  const creditors = ordered(1)
  const debtors = ordered(-1)
  const payments: Payment[] = []
  let credit = 0
  let debt = 0
  while (credit < creditors.length && debt < debtors.length) {
    const amountCents = Math.min(creditors[credit].cents, debtors[debt].cents)
    payments.push({ from: debtors[debt].person, to: creditors[credit].person, amountCents })
    creditors[credit].cents -= amountCents
    debtors[debt].cents -= amountCents
    if (creditors[credit].cents === 0) credit += 1
    if (debtors[debt].cents === 0) debt += 1
  }
  return payments
}

const isValidIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// Error codes, never user-facing text, so the screen can translate them.
export const validateExpense = (expense: Expense): string[] => {
  const errors: string[] = []
  const title = expense.title.trim()
  if (title === '') errors.push('title-required')
  else if (title.length > MAX_TITLE) errors.push('title-too-long')
  if (
    !Number.isInteger(expense.amountCents) ||
    expense.amountCents <= 0 ||
    expense.amountCents > MAX_CENTS
  ) {
    errors.push('amount-invalid')
  }
  if (expense.paidBy === '') errors.push('payer-required')
  if (expense.participants.length === 0) errors.push('participants-required')
  if (new Set(expense.participants).size !== expense.participants.length) {
    errors.push('participants-duplicated')
  }
  if (expense.participants.length > MAX_PEOPLE) errors.push('participants-too-many')
  if (!isValidIsoDate(expense.date)) errors.push('date-invalid')
  if (expense.kind === 'payment') {
    if (expense.participants.length > 1) errors.push('payment-one-person')
    else if (expense.participants[0] === expense.paidBy) errors.push('payment-to-self')
  }
  return errors
}
