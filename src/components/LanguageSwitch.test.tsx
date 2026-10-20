// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { getLocale, setLocale } from '../i18n/i18n'
import { LanguageSwitch } from './LanguageSwitch'
import { Welcome } from './Welcome'

afterEach(() => setLocale('en'))

describe('LanguageSwitch', () => {
  it('marks the current language', () => {
    render(<LanguageSwitch />)
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'ES' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('changes the language of the whole screen at once', async () => {
    render(
      <>
        <LanguageSwitch />
        <Welcome onCreate={() => {}} onJoin={() => {}} onSignIn={() => {}} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Create a flat' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'ES' }))
    expect(getLocale()).toBe('es')
    expect(screen.getByRole('button', { name: 'Crear un piso' })).toBeTruthy()
  })
})
