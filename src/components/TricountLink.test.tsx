// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TricountLink } from './TricountLink'

const renderLink = (props: Partial<Parameters<typeof TricountLink>[0]> = {}) => {
  const onSave = vi.fn()
  render(
    <TricountLink
      url={undefined}
      canEdit={false}
      busy={false}
      error={null}
      onSave={onSave}
      {...props}
    />,
  )
  return { onSave }
}

describe('TricountLink', () => {
  it('opens the Tricount of the flat in a new tab without leaking the opener', () => {
    renderLink({ url: 'https://tricount.com/tABC' })
    const link = screen.getByRole('link', { name: /open tricount/i })
    expect(link.getAttribute('href')).toBe('https://tricount.com/tABC')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('tells flatmates when the owner has not added the link yet', () => {
    renderLink()
    expect(screen.getByText(/has not added the tricount link/i)).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('does not offer editing to anyone but the owner', () => {
    renderLink({ url: 'https://tricount.com/tABC' })
    expect(screen.queryByRole('button', { name: /link/i })).toBeNull()
  })

  it('lets the owner add the link', async () => {
    const { onSave } = renderLink({ canEdit: true })
    await userEvent.click(screen.getByRole('button', { name: /add tricount link/i }))
    await userEvent.type(screen.getByLabelText('Tricount link'), ' https://tricount.com/tNEW ')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith('https://tricount.com/tNEW')
  })

  it('lets the owner remove the link by saving it empty', async () => {
    const { onSave } = renderLink({ canEdit: true, url: 'https://tricount.com/tABC' })
    await userEvent.click(screen.getByRole('button', { name: /edit tricount link/i }))
    await userEvent.clear(screen.getByLabelText('Tricount link'))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it.each([
    ['http://tricount.com/abc', /must start with https/i],
    ['https://evil.com/abc', /tricount\.com/i],
  ])('rejects %s and explains why', async (value, message) => {
    const { onSave } = renderLink({ canEdit: true })
    await userEvent.click(screen.getByRole('button', { name: /add tricount link/i }))
    await userEvent.type(screen.getByLabelText('Tricount link'), value)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(message)).toBeTruthy()
  })

  it('shows a failed save and disables the button while busy', async () => {
    renderLink({ canEdit: true, error: 'Could not save', busy: true })
    await userEvent.click(screen.getByRole('button', { name: /add tricount link/i }))
    expect(screen.getByText('Could not save')).toBeTruthy()
    expect((screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
