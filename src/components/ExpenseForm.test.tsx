// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Expense } from '../domain/expenses'
import { setLocale } from '../i18n/i18n'
import { ExpenseForm } from './ExpenseForm'

afterEach(() => setLocale('en'))

const people = [
  { id: 'm0', name: 'Ana' },
  { id: 'm1', name: 'Ben' },
  { id: 'm2', name: 'Carla' },
]

const setup = (overrides: Partial<Parameters<typeof ExpenseForm>[0]> = {}) => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <ExpenseForm
      people={people}
      currentMemberId="m1"
      today="2026-10-28"
      busy={false}
      error={null}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSave, onCancel }
}

describe('ExpenseForm', () => {
  it('starts with the person who is writing as the one who paid, today, and everybody sharing it', () => {
    setup()
    expect((screen.getByLabelText(/who paid/i) as HTMLSelectElement).value).toBe('m1')
    expect((screen.getByLabelText(/^date$/i) as HTMLInputElement).value).toBe('2026-10-28')
    expect(
      (
        screen.getByRole('checkbox', {
          name: /split equally between everybody/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true)
    expect(screen.queryByRole('checkbox', { name: 'Ana' })).toBeNull()
  })

  it('saves an expense split between everybody', async () => {
    const { onSave } = setup()
    await userEvent.type(screen.getByLabelText(/what was it for/i), 'Cleaning products')
    await userEvent.type(screen.getByLabelText(/amount/i), '12,50')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledWith({
      title: 'Cleaning products',
      amountCents: 1250,
      paidBy: 'm1',
      participants: ['m0', 'm1', 'm2'],
      date: '2026-10-28',
    })
  })

  it('lets the person say who paid', async () => {
    const { onSave } = setup()
    await userEvent.type(screen.getByLabelText(/what was it for/i), 'Dinner')
    await userEvent.type(screen.getByLabelText(/amount/i), '30')
    await userEvent.selectOptions(screen.getByLabelText(/who paid/i), 'm2')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave.mock.calls[0][0].paidBy).toBe('m2')
  })

  it('splits only between some people when it is not equal among everybody', async () => {
    const { onSave } = setup()
    await userEvent.type(screen.getByLabelText(/what was it for/i), 'Beers')
    await userEvent.type(screen.getByLabelText(/amount/i), '9')
    await userEvent.click(
      screen.getByRole('checkbox', { name: /split equally between everybody/i }),
    )
    // Everybody starts ticked; Carla did not have any
    await userEvent.click(screen.getByRole('checkbox', { name: 'Carla' }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave.mock.calls[0][0].participants).toEqual(['m0', 'm1'])
  })

  it('does not accept an expense that is split between nobody', async () => {
    const { onSave } = setup()
    await userEvent.type(screen.getByLabelText(/what was it for/i), 'Beers')
    await userEvent.type(screen.getByLabelText(/amount/i), '9')
    await userEvent.click(
      screen.getByRole('checkbox', { name: /split equally between everybody/i }),
    )
    for (const name of ['Ana', 'Ben', 'Carla']) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/choose who it is split between/i)).toBeTruthy()
  })

  it('says what is missing: a title and a real amount', async () => {
    const { onSave } = setup()
    await userEvent.type(screen.getByLabelText(/amount/i), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/write what it was for/i)).toBeTruthy()
    expect(screen.getByText(/write an amount in euros/i)).toBeTruthy()
  })

  it('makes Save the wide button next to Cancel, as it is the action the person came for', () => {
    setup()
    const save = getComputedStyle(screen.getByRole('button', { name: /^save$/i }))
    const cancel = getComputedStyle(screen.getByRole('button', { name: /^cancel$/i }))
    expect(save.flexGrow).toBe('1')
    expect(cancel.flexGrow).not.toBe('1')
  })

  it('puts the cursor on the first field when it opens, so a keyboard or a screen reader starts there', () => {
    setup()
    expect(document.activeElement).toBe(screen.getByLabelText(/what was it for/i))
  })

  it('marks each wrong field and says what is wrong right next to it, not only in a banner', async () => {
    setup()
    await userEvent.type(screen.getByLabelText(/amount/i), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    const title = screen.getByLabelText(/what was it for/i)
    const amount = screen.getByLabelText(/amount/i)
    const date = screen.getByLabelText(/^date$/i)
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(amount.getAttribute('aria-invalid')).toBe('true')
    expect(date.getAttribute('aria-invalid')).not.toBe('true')
    // The message is tied to its field, so it is read when the field is reached
    const describedBy = (field: HTMLElement) =>
      document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent
    expect(describedBy(title)).toBe('Write what it was for.')
    expect(describedBy(amount)).toBe('Write an amount in euros.')
  })

  it('shows an expense that is being edited with its values, split between some people', () => {
    const expense: Expense = {
      id: 'e1',
      kind: 'expense',
      title: 'Soap',
      amountCents: 905,
      paidBy: 'm0',
      participants: ['m0', 'm2'],
      date: '2026-10-20',
      createdBy: 'm0',
    }
    setup({ initial: expense })
    expect((screen.getByLabelText(/what was it for/i) as HTMLInputElement).value).toBe('Soap')
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('9.05')
    expect((screen.getByLabelText(/who paid/i) as HTMLSelectElement).value).toBe('m0')
    expect(
      (
        screen.getByRole('checkbox', {
          name: /split equally between everybody/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false)
    expect((screen.getByRole('checkbox', { name: 'Ben' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: 'Carla' }) as HTMLInputElement).checked).toBe(true)
  })

  it('shows a failed save, cannot be pressed twice and can be cancelled', async () => {
    const { onCancel } = setup({ busy: true, error: 'Could not save' })
    expect(screen.getByText('Could not save')).toBeTruthy()
    expect((screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
