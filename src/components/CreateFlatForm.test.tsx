// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CreateFlatForm } from './CreateFlatForm'

const setup = (overrides: Partial<Parameters<typeof CreateFlatForm>[0]> = {}) => {
  const onSubmit = vi.fn()
  const onBack = vi.fn()
  render(
    <CreateFlatForm
      initialStartDate="2026-10-12"
      busy={false}
      submitError={null}
      onSubmit={onSubmit}
      onBack={onBack}
      {...overrides}
    />,
  )
  return { onSubmit, onBack }
}

const fillBasics = async () => {
  await userEvent.type(screen.getByLabelText('Flat name'), '  Our flat ')
  await userEvent.type(screen.getByLabelText('Person 1'), 'Ana')
  await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
}

describe('CreateFlatForm', () => {
  it('starts with the suggested zones and the given start date', () => {
    setup()
    expect((screen.getByLabelText('Zone 1') as HTMLInputElement).value).toBe('Living room')
    expect((screen.getByLabelText('Zone 2') as HTMLInputElement).value).toBe('Kitchen')
    expect((screen.getByLabelText('Zone 3') as HTMLInputElement).value).toBe('Bathroom')
    expect((screen.getByLabelText('Start of the rotation') as HTMLInputElement).value).toBe(
      '2026-10-12',
    )
  })

  it('submits a normalized draft and the person who is creating the flat', async () => {
    const { onSubmit } = setup()
    await fillBasics()
    await userEvent.click(screen.getAllByRole('radio')[1])
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      {
        name: 'Our flat',
        members: ['Ana', 'Ben'],
        zones: ['Living room', 'Kitchen', 'Bathroom'],
        startDate: '2026-10-12',
      },
      'Ben',
    )
  })

  it('assumes the first person is the creator by default', async () => {
    const { onSubmit } = setup()
    await fillBasics()
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit.mock.calls[0][1]).toBe('Ana')
  })

  it('adds and removes people and zones', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /add person/i }))
    expect(screen.getByLabelText('Person 3')).toBeTruthy()
    await userEvent.click(screen.getAllByRole('button', { name: /remove person/i })[2])
    expect(screen.queryByLabelText('Person 3')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /add zone/i }))
    expect(screen.getByLabelText('Zone 4')).toBeTruthy()
    await userEvent.click(screen.getAllByRole('button', { name: /remove zone/i })[3])
    expect(screen.queryByLabelText('Zone 4')).toBeNull()
  })

  it('shows every validation problem and does not submit', async () => {
    const { onSubmit } = setup()
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/give the flat a name/i)).toBeTruthy()
    expect(screen.getByText(/add at least one person/i)).toBeTruthy()
  })

  it('requires the creator to be a named person', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText('Flat name'), 'Flat')
    await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/choose which person you are/i)).toBeTruthy()
  })

  it('shows the error of a failed submission and disables the button while busy', () => {
    setup({ submitError: 'Something went wrong', busy: true })
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect((screen.getByRole('button', { name: /creating/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('goes back', async () => {
    const { onBack } = setup()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
