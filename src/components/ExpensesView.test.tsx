// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Expense } from '../domain/expenses'
import { setLocale } from '../i18n/i18n'
import { ExpensesView } from './ExpensesView'

afterEach(() => setLocale('en'))

const people = [
  { id: 'm0', name: 'Ana', color: '#1976d2' },
  { id: 'm1', name: 'Ben', color: '#388e3c' },
  { id: 'm2', name: 'Carla', color: '#f57c00' },
]

const dinner: Expense = {
  id: 'e1',
  kind: 'expense',
  title: 'Dinner',
  amountCents: 3000,
  paidBy: 'm0',
  participants: ['m0', 'm1', 'm2'],
  date: '2026-10-20',
  createdBy: 'm0',
}
const soap: Expense = {
  id: 'e2',
  kind: 'expense',
  title: 'Soap',
  amountCents: 600,
  paidBy: 'm1',
  participants: ['m1', 'm2'],
  date: '2026-10-25',
  createdBy: 'm1',
}

const setup = (overrides: Partial<Parameters<typeof ExpensesView>[0]> = {}) => {
  const handlers = {
    onAdd: vi.fn().mockResolvedValue(true),
    onEdit: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn(),
    onPay: vi.fn().mockResolvedValue(true),
  }
  render(
    <ExpensesView
      expenses={[dinner, soap]}
      people={people}
      currentMemberId="m1"
      today="2026-10-28"
      busy={false}
      error={null}
      footer={<p>Tricount footer</p>}
      {...handlers}
      {...overrides}
    />,
  )
  return handlers
}

describe('ExpensesView', () => {
  it('lists the expenses, the newest first, with who paid and between how many', () => {
    setup()
    const items = screen.getAllByRole('listitem').filter((item) => item.dataset.expense)
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Soap',
      'Dinner',
    ])
    expect(within(items[0]).getByText('€6.00')).toBeTruthy()
    expect(within(items[0]).getByText(/paid by ben/i)).toBeTruthy()
    expect(within(items[0]).getByText(/split between 2 people/i)).toBeTruthy()
    expect(within(items[1]).getByText(/split between everybody/i)).toBeTruthy()
  })

  it('shows the four latest expenses and keeps the rest behind a button that shows them all', async () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      ...dinner,
      id: `e${index}`,
      title: `Expense ${index}`,
      date: `2026-10-${String(10 + index).padStart(2, '0')}`,
    }))
    setup({ expenses: many })
    const rows = () => screen.getAllByRole('listitem').filter((item) => item.dataset.expense)
    expect(rows()).toHaveLength(4)

    await userEvent.click(screen.getByRole('button', { name: 'Show 3 more' }))
    expect(rows()).toHaveLength(7)

    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(rows()).toHaveLength(4)
  })

  it('has no button to show more when everything fits', () => {
    setup()
    expect(screen.queryByRole('button', { name: /show .* more/i })).toBeNull()
  })

  it('shows the amount of an expense in red, and the avatar of who paid it in their color', () => {
    setup()
    const row = screen.getAllByRole('listitem').find((item) => item.dataset.expense === 'e2')!
    expect(getComputedStyle(within(row).getByText('€6.00')).color).not.toBe(
      getComputedStyle(document.body).color,
    )
    const avatar = within(row).getByText('B')
    expect(getComputedStyle(avatar).backgroundColor).toBe('rgb(56, 142, 60)')
  })

  it('says when there are no expenses yet', () => {
    setup({ expenses: [] })
    expect(screen.getByText(/no expenses yet/i)).toBeTruthy()
  })

  describe('where the person stands, at the top', () => {
    const hero = () => document.querySelector('[data-standing]') as HTMLElement

    it('says how much the person is owed, with their own big amount', () => {
      setup({ currentMemberId: 'm0' })
      expect(hero().dataset.standing).toBe('owed')
      expect(within(hero()).getByText('You are owed')).toBeTruthy()
      expect(within(hero()).getByText('€20.00')).toBeTruthy()
    })

    it('says how much the person owes', () => {
      setup({ currentMemberId: 'm1' })
      expect(hero().dataset.standing).toBe('owe')
      expect(within(hero()).getByText('You owe')).toBeTruthy()
      expect(within(hero()).getByText('€7.00')).toBeTruthy()
    })

    it('says that the person is all square, and that there is nothing to split yet', () => {
      // Ben owes 10 for the dinner and pays it back
      const payBack: Expense = {
        id: 'p9',
        kind: 'payment',
        title: 'Payment',
        amountCents: 1000,
        paidBy: 'm1',
        participants: ['m0'],
        date: '2026-10-27',
        createdBy: 'm1',
      }
      setup({ expenses: [dinner, payBack] })
      expect(hero().dataset.standing).toBe('even')
      expect(within(hero()).getByText(/all square/i)).toBeTruthy()
    })

    it('has a first thing to do when there are no expenses', () => {
      setup({ expenses: [] })
      expect(hero().dataset.standing).toBe('empty')
      expect(within(hero()).getByText(/nothing to split yet/i)).toBeTruthy()
    })
  })

  it('shows who is owed and who owes', () => {
    setup()
    // Ana paid 30 (owed 20), Ben paid 6 and owes 10 for the dinner and 3 for the soap, Carla owes 13
    const balances = screen.getByRole('region', { name: /balances/i })
    expect(within(balances).getByText(/ana is owed €20\.00/i)).toBeTruthy()
    expect(within(balances).getByText(/ben owes €7\.00/i)).toBeTruthy()
    expect(within(balances).getByText(/carla owes €13\.00/i)).toBeTruthy()
  })

  it('suggests the payments that settle everything and registers one that involves the person', async () => {
    const { onPay } = setup()
    const payments = screen.getByRole('region', { name: /settle up/i })
    expect(within(payments).getByText(/ben pays ana €7\.00/i)).toBeTruthy()
    // Carla pays Ana: it does not involve Ben, so he cannot register it
    expect(within(payments).getByText(/carla pays ana €13\.00/i)).toBeTruthy()
    expect(within(payments).getAllByRole('button', { name: /mark as paid/i })).toHaveLength(1)
    await userEvent.click(within(payments).getByRole('button', { name: /mark as paid/i }))
    expect(onPay).toHaveBeenCalledWith({ from: 'm1', to: 'm0', amountCents: 700 })
  })

  it('says that everything is settled when it is', () => {
    setup({ expenses: [] })
    expect(screen.getByText(/everything is settled/i)).toBeTruthy()
  })

  it('shows a payment as a payment, with who paid whom', () => {
    const payment: Expense = {
      id: 'p1',
      kind: 'payment',
      title: 'Payment',
      amountCents: 700,
      paidBy: 'm1',
      participants: ['m0'],
      date: '2026-10-27',
      createdBy: 'm1',
    }
    setup({ expenses: [dinner, soap, payment] })
    const item = screen.getByText('Ben paid Ana').closest('li')!
    expect(within(item).getByText('€7.00')).toBeTruthy()
  })

  it('offers to edit and delete only the expenses that the person wrote', () => {
    setup()
    expect(screen.getByRole('button', { name: /edit soap/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /delete soap/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /edit dinner/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete dinner/i })).toBeNull()
  })

  it('asks before deleting, and nothing happens if it is given up', async () => {
    const { onDelete } = setup()
    await userEvent.click(screen.getByRole('button', { name: /delete soap/i }))
    expect(onDelete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onDelete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /delete soap/i }))
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }))
    expect(onDelete).toHaveBeenCalledWith('e2')
  })

  it('adds an expense with the form and closes it when it is saved', async () => {
    const { onAdd } = setup()
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }))
    await userEvent.type(screen.getByLabelText(/what was it for/i), 'Bread')
    await userEvent.type(screen.getByLabelText(/amount/i), '2,40')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onAdd).toHaveBeenCalledWith({
      title: 'Bread',
      amountCents: 240,
      paidBy: 'm1',
      participants: ['m0', 'm1', 'm2'],
      date: '2026-10-28',
    })
    expect(await screen.findByRole('button', { name: /add expense/i })).toBeTruthy()
    expect(screen.queryByLabelText(/what was it for/i)).toBeNull()
  })

  it('puts the cursor back on the button that opened the form when it is closed', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }))
    expect(document.activeElement).toBe(screen.getByLabelText(/what was it for/i))

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    // Otherwise a keyboard or a screen reader is left at the top of the page and loses its place
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /add expense/i }))
  })

  it('edits an expense of the person with the form', async () => {
    const { onEdit } = setup()
    await userEvent.click(screen.getByRole('button', { name: /edit soap/i }))
    const title = screen.getByLabelText(/what was it for/i)
    await userEvent.clear(title)
    await userEvent.type(title, 'Soap and sponges')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onEdit).toHaveBeenCalledWith(
      soap,
      expect.objectContaining({ title: 'Soap and sponges', amountCents: 600 }),
    )
  })

  it('keeps the form open when saving fails', async () => {
    setup({ onAdd: vi.fn().mockResolvedValue(false), error: 'Could not save' })
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }))
    await userEvent.type(screen.getByLabelText(/what was it for/i), 'Bread')
    await userEvent.type(screen.getByLabelText(/amount/i), '2')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByLabelText(/what was it for/i)).toBeTruthy()
    expect(screen.getByText('Could not save')).toBeTruthy()
  })

  it('shows the footer with the link to Tricount at the bottom', () => {
    setup()
    expect(screen.getByText('Tricount footer')).toBeTruthy()
  })
})
