// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InviteCode } from './InviteCode'

const setNavigator = (values: Record<string, unknown>) => {
  Object.entries(values).forEach(([key, value]) =>
    Object.defineProperty(window.navigator, key, { value, configurable: true }),
  )
}

afterEach(() => {
  setNavigator({ share: undefined, clipboard: undefined })
})

describe('InviteCode', () => {
  it('shows the code highlighted', () => {
    render(<InviteCode code="LDKSG9" appUrl="https://housely-prod.web.app" />)
    expect(screen.getByText(/invite code/i)).toBeTruthy()
    expect(screen.getByText('LDKSG9').tagName).toBe('STRONG')
  })

  it('opens the share sheet of the phone with a ready to send message', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNavigator({ share })
    render(<InviteCode code="LDKSG9" appUrl="https://housely-prod.web.app" />)
    await userEvent.click(screen.getByRole('button', { name: /share the code/i }))
    expect(share).toHaveBeenCalledTimes(1)
    const payload = share.mock.calls[0][0]
    expect(payload.text).toContain('LDKSG9')
    expect(payload.url).toBe('https://housely-prod.web.app')
  })

  it('copies the message when the browser cannot share, and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setNavigator({ share: undefined, clipboard: { writeText } })
    render(<InviteCode code="LDKSG9" appUrl="https://housely-prod.web.app" />)
    await userEvent.click(screen.getByRole('button', { name: /share the code/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('LDKSG9'))
    expect(await screen.findByText(/copied/i)).toBeTruthy()
  })

  it('stays quiet when the person closes the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'))
    setNavigator({ share })
    render(<InviteCode code="LDKSG9" appUrl="https://housely-prod.web.app" />)
    await userEvent.click(screen.getByRole('button', { name: /share the code/i }))
    expect(screen.queryByText(/copied/i)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('tells the person when nothing can share or copy', async () => {
    setNavigator({ share: undefined, clipboard: undefined })
    render(<InviteCode code="LDKSG9" appUrl="https://housely-prod.web.app" />)
    await userEvent.click(screen.getByRole('button', { name: /share the code/i }))
    expect(await screen.findByText(/send it by hand/i)).toBeTruthy()
  })
})
