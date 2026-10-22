// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
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
  const onLeave = vi.fn()
  render(
    <ThemeProvider theme={theme}>
      <SettingsView
        isGoogle={false}
        accountEmail={null}
        linkBusy={false}
        linkError={null}
        version="0.2.0"
        onLinkGoogle={onLinkGoogle}
        onLeave={onLeave}
        {...overrides}
      />
    </ThemeProvider>,
  )
  return { onLinkGoogle, onLeave }
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

  it('leaves the flat on this device', async () => {
    const { onLeave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /leave this flat on this device/i }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('says which version of the app this is', () => {
    setup()
    expect(screen.getByText(/housely v0\.2\.0/i)).toBeTruthy()
  })
})
