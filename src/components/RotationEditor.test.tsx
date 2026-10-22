// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RotationEditor } from './RotationEditor'

const people = [
  { id: 'm0', name: 'Ana' },
  { id: 'm1', name: 'Ben' },
]

const setup = (overrides: Partial<Parameters<typeof RotationEditor>[0]> = {}) => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <RotationEditor
      people={people}
      zones={['Kitchen', 'Bathroom']}
      canAddPeople
      appliesFrom="2026-10-26"
      problems={[]}
      busy={false}
      error={null}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSave, onCancel }
}

describe('RotationEditor', () => {
  it('starts with the current people and zones', () => {
    setup()
    expect((screen.getByLabelText('Person 1') as HTMLInputElement).value).toBe('Ana')
    expect((screen.getByLabelText('Person 2') as HTMLInputElement).value).toBe('Ben')
    expect((screen.getByLabelText('Zone 1') as HTMLInputElement).value).toBe('Kitchen')
    expect((screen.getByLabelText('Zone 2') as HTMLInputElement).value).toBe('Bathroom')
  })

  it('says from when the change applies and that this week stays as it is', () => {
    setup()
    expect(screen.getByText(/from 2026-10-26/i)).toBeTruthy()
    expect(screen.getByText(/this week stays as it is/i)).toBeTruthy()
  })

  it('keeps the id of the people that were there and leaves new ones without id', async () => {
    const { onSave } = setup()
    await userEvent.clear(screen.getByLabelText('Person 2'))
    await userEvent.type(screen.getByLabelText('Person 2'), 'Benjamin')
    await userEvent.click(screen.getByRole('button', { name: /add person/i }))
    await userEvent.type(screen.getByLabelText('Person 3'), 'Dani')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledWith({
      people: [{ id: 'm0', name: 'Ana' }, { id: 'm1', name: 'Benjamin' }, { name: 'Dani' }],
      zones: ['Kitchen', 'Bathroom'],
    })
  })

  it('removes a person and a zone', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getAllByRole('button', { name: /remove person/i })[0])
    await userEvent.click(screen.getAllByRole('button', { name: /remove zone/i })[1])
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledWith({
      people: [{ id: 'm1', name: 'Ben' }],
      zones: ['Kitchen'],
    })
  })

  it('adds zones', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /add zone/i }))
    await userEvent.type(screen.getByLabelText('Zone 3'), 'Garden')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave.mock.calls[0][0].zones).toEqual(['Kitchen', 'Bathroom', 'Garden'])
  })

  it('explains why nobody else can be added when the flat has used every id', () => {
    setup({ canAddPeople: false })
    expect(
      (screen.getByRole('button', { name: /add person/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText(/limit of 20 people/i)).toBeTruthy()
  })

  it('shows what is wrong, in words', () => {
    setup({ problems: ['members-duplicated', 'zones-required'] })
    expect(screen.getByText(/two people have the same name/i)).toBeTruthy()
    expect(screen.getByText(/add at least one zone/i)).toBeTruthy()
  })

  it('shows a failed save and cannot be pressed twice while saving', () => {
    setup({ error: 'Could not save', busy: true })
    expect(screen.getByText('Could not save')).toBeTruthy()
    expect((screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('can be cancelled', async () => {
    const { onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
