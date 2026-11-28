// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareButton } from './ShareButton'

const setNavigator = (values: Record<string, unknown>) => {
  Object.entries(values).forEach(([key, value]) =>
    Object.defineProperty(window.navigator, key, { value, configurable: true }),
  )
}

afterEach(() => setNavigator({ share: undefined, clipboard: undefined }))

const setup = () => render(<ShareButton message="Week 3 rotation" label="Share rotation" />)

describe('ShareButton', () => {
  it('opens the share sheet of the phone when there is one, with the message', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNavigator({ share })
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Share rotation' }))

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: 'Week 3 rotation' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('stays quiet when the person closes the share sheet', async () => {
    setNavigator({ share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')) })
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Share rotation' }))

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers WhatsApp, Telegram, email and copy when the browser has no share sheet', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Share rotation' }))

    const menu = await screen.findByRole('menu')
    expect(menu).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'WhatsApp' }).getAttribute('href')).toBe(
      'https://wa.me/?text=Week%203%20rotation',
    )
    expect(screen.getByRole('menuitem', { name: 'Telegram' }).getAttribute('href')).toContain(
      'https://t.me/share/url?',
    )
    expect(screen.getByRole('menuitem', { name: 'Email' }).getAttribute('href')).toBe(
      'mailto:?subject=Housely&body=Week%203%20rotation',
    )
    expect(screen.getByRole('menuitem', { name: 'Copy text' })).toBeTruthy()
  })

  it('copies the message and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setNavigator({ clipboard: { writeText } })
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Share rotation' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Copy text' }))

    expect(writeText).toHaveBeenCalledWith('Week 3 rotation')
    expect(await screen.findByText(/copied/i)).toBeTruthy()
  })

  it('tells the person to send it by hand when nothing can copy', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Share rotation' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Copy text' }))

    expect(await screen.findByText(/send it by hand/i)).toBeTruthy()
  })
})
