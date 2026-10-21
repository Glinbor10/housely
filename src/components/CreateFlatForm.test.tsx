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

const next = () => userEvent.click(screen.getByRole('button', { name: /^next$/i }))

const fillFlat = async () => {
  await userEvent.type(screen.getByLabelText('Flat name'), '  Our flat ')
  await next()
}

const fillPeople = async () => {
  await userEvent.type(screen.getByLabelText('Person 1'), 'Ana')
  await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
  await next()
}

describe('CreateFlatForm', () => {
  it('starts with the flat step: its name and the start date, nothing else', () => {
    setup()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
    expect((screen.getByLabelText('Start of the rotation') as HTMLInputElement).value).toBe(
      '2026-10-12',
    )
    expect(screen.queryByLabelText('Person 1')).toBeNull()
    expect(screen.queryByLabelText('Zone 1')).toBeNull()
  })

  it('does not leave a step with problems, and says what is wrong', async () => {
    setup()
    await next()
    expect(screen.getByText(/give the flat a name/i)).toBeTruthy()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
  })

  it('checks the people before moving on, including who the creator is', async () => {
    setup()
    await fillFlat()
    await next()
    expect(screen.getByText(/add at least one person/i)).toBeTruthy()

    await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
    await next()
    expect(screen.getByText(/choose which person you are/i)).toBeTruthy()
    expect(screen.getByText('Step 2 of 3')).toBeTruthy()
  })

  it('walks the three steps and submits a normalized draft', async () => {
    const { onSubmit } = setup()
    await fillFlat()
    await fillPeople()
    expect(screen.getByText('Step 3 of 3')).toBeTruthy()
    expect((screen.getByLabelText('Zone 1') as HTMLInputElement).value).toBe('Living room')
    expect((screen.getByLabelText('Zone 2') as HTMLInputElement).value).toBe('Kitchen')
    expect((screen.getByLabelText('Zone 3') as HTMLInputElement).value).toBe('Bathroom')

    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      {
        name: 'Our flat',
        members: ['Ana', 'Ben'],
        zones: ['Living room', 'Kitchen', 'Bathroom'],
        startDate: '2026-10-12',
      },
      'Ana',
    )
  })

  it('submits the person picked as the creator', async () => {
    const { onSubmit } = setup()
    await fillFlat()
    await userEvent.type(screen.getByLabelText('Person 1'), 'Ana')
    await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
    await userEvent.click(screen.getAllByRole('radio')[1])
    await next()
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit.mock.calls[0][1]).toBe('Ben')
  })

  it('keeps what was typed when going back and forth', async () => {
    setup()
    await fillFlat()
    await fillPeople()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect((screen.getByLabelText('Person 2') as HTMLInputElement).value).toBe('Ben')
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect((screen.getByLabelText('Flat name') as HTMLInputElement).value).toBe('  Our flat ')
  })

  it('adds and removes people and zones', async () => {
    setup()
    await fillFlat()
    await userEvent.click(screen.getByRole('button', { name: /add person/i }))
    expect(screen.getByLabelText('Person 3')).toBeTruthy()
    await userEvent.click(screen.getAllByRole('button', { name: /remove person/i })[2])
    expect(screen.queryByLabelText('Person 3')).toBeNull()

    await userEvent.type(screen.getByLabelText('Person 1'), 'Ana')
    await next()
    await userEvent.click(screen.getByRole('button', { name: /add zone/i }))
    expect(screen.getByLabelText('Zone 4')).toBeTruthy()
    await userEvent.click(screen.getAllByRole('button', { name: /remove zone/i })[3])
    expect(screen.queryByLabelText('Zone 4')).toBeNull()
  })

  it('does not submit a flat without zones', async () => {
    const { onSubmit } = setup()
    await fillFlat()
    await fillPeople()
    for (const field of ['Zone 1', 'Zone 2', 'Zone 3']) {
      await userEvent.clear(screen.getByLabelText(field))
    }
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/add at least one zone/i)).toBeTruthy()
  })

  it('shows the error of a failed submission and disables the button while busy', async () => {
    setup({ submitError: 'Something went wrong', busy: true })
    await fillFlat()
    await fillPeople()
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect((screen.getByRole('button', { name: /creating/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('goes back to the welcome screen from the first step', async () => {
    const { onBack } = setup()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
