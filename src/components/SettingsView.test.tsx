// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLocale, setLocale } from '../i18n/i18n'
import { theme } from '../theme'
import { SettingsView } from './SettingsView'

afterEach(() => {
  setLocale('en')
  window.localStorage.clear()
})

const setup = (overrides: Partial<Parameters<typeof SettingsView>[0]> = {}) => {
  const onLinkGoogle = vi.fn()
  const onLogOut = vi.fn()
  const onChangeFlat = vi.fn()
  const onDeleteFlat = vi.fn()
  render(
    <ThemeProvider theme={theme}>
      <SettingsView
        isGoogle={false}
        accountEmail={null}
        linkBusy={false}
        linkError={null}
        version="0.2.0"
        onLinkGoogle={onLinkGoogle}
        logOutBusy={false}
        logOutError={null}
        onLogOut={onLogOut}
        onChangeFlat={onChangeFlat}
        isOwner={false}
        flatName="Piso grande"
        online
        onDeleteFlat={onDeleteFlat}
        {...overrides}
      />
    </ThemeProvider>,
  )
  return { onLinkGoogle, onLogOut, onChangeFlat, onDeleteFlat }
}

describe('SettingsView', () => {
  it('changes the language of the whole app', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'ES' }))
    expect(getLocale()).toBe('es')
    expect(screen.getByText('Idioma')).toBeTruthy()
  })

  it('lets people choose light, dark or follow the device, and shows the choice', async () => {
    setup()
    const dark = screen.getByRole('button', { name: /^dark$/i })
    await userEvent.click(dark)
    expect(dark.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: /^light$/i }))
    expect(dark.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /^light$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('remembers the theme for the next visit', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /^dark$/i }))
    expect(window.localStorage.getItem('mui-mode')).toBe('dark')
  })

  it('invites a person without Google to link it, and says why', async () => {
    const { onLinkGoogle } = setup()
    expect(screen.getByText(/not linked/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /link google/i }))
    expect(onLinkGoogle).toHaveBeenCalledTimes(1)
  })

  it('shows the Google account that is linked and offers nothing to link', () => {
    setup({ isGoogle: true, accountEmail: 'ana@example.com' })
    expect(screen.getByText(/ana@example.com/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /link google/i })).toBeNull()
  })

  it('shows that linking is in progress, and what went wrong', () => {
    setup({ linkBusy: true, linkError: 'Could not link' })
    expect((screen.getByRole('button', { name: /linking/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(screen.getByText('Could not link')).toBeTruthy()
  })

  it('draws the actions that cannot be taken back as buttons with a red border, not as loose red text', () => {
    setup({ isOwner: true })
    for (const name of [/^log out$/i, /^delete home$/i]) {
      const button = screen.getByRole('button', { name })
      expect(button.className).toContain('MuiButton-outlined')
      expect(button.className).toContain('MuiButton-colorError')
    }
  })

  it('asks to confirm before logging out, and nothing happens if it is given up', async () => {
    const { onLogOut } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^log out$/i }))
    expect(onLogOut).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onLogOut).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('button', { name: /yes, log out/i })).toBeNull())
  })

  it('logs out once it is confirmed', async () => {
    const { onLogOut } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^log out$/i }))
    await userEvent.click(screen.getByRole('button', { name: /yes, log out/i }))
    expect(onLogOut).toHaveBeenCalledTimes(1)
  })

  it('tells a person with Google that the flats come back when they sign in again', async () => {
    setup({ isGoogle: true, accountEmail: 'ana@example.com' })
    await userEvent.click(screen.getByRole('button', { name: /^log out$/i }))
    expect(screen.getByText(/sign in with google again and your homes come back/i)).toBeTruthy()
  })

  it('warns a person without Google that they need the invite code and that somebody frees their name', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /^log out$/i }))
    expect(screen.getByText(/without google/i)).toBeTruthy()
    expect(screen.getByText(/must free your name/i)).toBeTruthy()
  })

  it('shows that it is logging out and what went wrong', async () => {
    setup({ logOutBusy: true, logOutError: 'Could not log out' })
    await userEvent.click(screen.getByRole('button', { name: /^log out$/i }))
    expect(
      (screen.getByRole('button', { name: /logging out/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText('Could not log out')).toBeTruthy()
  })

  describe('deleting the home', () => {
    it('offers it only to the owner', () => {
      setup()
      expect(screen.queryByRole('button', { name: /delete home/i })).toBeNull()
    })

    it('warns that it is for everybody and cannot be undone, and does nothing yet', async () => {
      const { onDeleteFlat } = setup({ isOwner: true })
      await userEvent.click(screen.getByRole('button', { name: /^delete home$/i }))
      expect(screen.getByText(/for everyone/i)).toBeTruthy()
      expect(screen.getByText(/cannot be undone/i)).toBeTruthy()
      expect(onDeleteFlat).not.toHaveBeenCalled()
    })

    it('asks to type the name of the home, and only then lets it go on', async () => {
      const { onDeleteFlat } = setup({ isOwner: true })
      await userEvent.click(screen.getByRole('button', { name: /^delete home$/i }))
      const confirm = screen.getByRole('button', { name: /delete for good/i }) as HTMLButtonElement
      expect(confirm.disabled).toBe(true)

      await userEvent.type(screen.getByLabelText(/type the name/i), 'Piso grand')
      expect(confirm.disabled).toBe(true)
      await userEvent.type(screen.getByLabelText(/type the name/i), 'e')
      expect(confirm.disabled).toBe(false)

      await userEvent.click(confirm)
      expect(onDeleteFlat).toHaveBeenCalledTimes(1)
    })

    it('forgets what was typed when it is given up', async () => {
      const { onDeleteFlat } = setup({ isOwner: true })
      await userEvent.click(screen.getByRole('button', { name: /^delete home$/i }))
      await userEvent.type(screen.getByLabelText(/type the name/i), 'Piso grande')
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      await waitFor(() => expect(screen.queryByLabelText(/type the name/i)).toBeNull())

      await userEvent.click(screen.getByRole('button', { name: /^delete home$/i }))
      expect(
        (screen.getByRole('button', { name: /delete for good/i }) as HTMLButtonElement).disabled,
      ).toBe(true)
      expect(onDeleteFlat).not.toHaveBeenCalled()
    })

    it('cannot be started without a connection, and says why', () => {
      setup({ isOwner: true, online: false })
      expect(
        (screen.getByRole('button', { name: /^delete home$/i }) as HTMLButtonElement).disabled,
      ).toBe(true)
      expect(screen.getByText(/need a connection/i)).toBeTruthy()
    })
  })

  it('says which version of the app this is', () => {
    setup()
    expect(screen.getByText(/housely v0\.2\.0/i)).toBeTruthy()
  })
})
