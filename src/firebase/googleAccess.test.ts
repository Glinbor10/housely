import { describe, expect, it, vi } from 'vitest'
import { continueWithGoogle, GoogleAccessError, isGoogleUser } from './googleAccess'

const anonymous = { uid: 'anon-uid', isAnonymous: true, providerIds: [] }
const google = { uid: 'google-uid', isAnonymous: false, providerIds: ['google.com'] }

const deps = (overrides: Partial<Parameters<typeof continueWithGoogle>[0]> = {}) => ({
  user: anonymous as Parameters<typeof continueWithGoogle>[0]['user'],
  link: vi.fn().mockResolvedValue({ uid: 'anon-uid' }),
  signIn: vi.fn().mockResolvedValue({ uid: 'google-uid' }),
  signInWithCredentialFromError: vi.fn().mockResolvedValue(null),
  ...overrides,
})

const firebaseError = (code: string) => Object.assign(new Error(code), { code })

describe('isGoogleUser', () => {
  it('is true only when the Google provider is linked', () => {
    expect(isGoogleUser(google)).toBe(true)
    expect(isGoogleUser(anonymous)).toBe(false)
    expect(isGoogleUser(null)).toBe(false)
    expect(isGoogleUser({ ...anonymous, providerIds: ['password'] })).toBe(false)
  })
})

describe('continueWithGoogle', () => {
  it('does nothing when the person already uses Google', async () => {
    const d = deps({ user: google })
    expect(await continueWithGoogle(d)).toEqual({ kind: 'already', uid: 'google-uid' })
    expect(d.link).not.toHaveBeenCalled()
    expect(d.signIn).not.toHaveBeenCalled()
  })

  it('links an anonymous identity to Google keeping the same uid', async () => {
    const d = deps()
    expect(await continueWithGoogle(d)).toEqual({ kind: 'linked', uid: 'anon-uid' })
    expect(d.link).toHaveBeenCalledTimes(1)
    expect(d.signIn).not.toHaveBeenCalled()
  })

  it('signs in to the existing Google account when Google already knows the person', async () => {
    const d = deps({
      link: vi.fn().mockRejectedValue(firebaseError('auth/credential-already-in-use')),
      signInWithCredentialFromError: vi.fn().mockResolvedValue({ uid: 'google-uid' }),
    })
    expect(await continueWithGoogle(d)).toEqual({ kind: 'signed-in', uid: 'google-uid' })
    expect(d.signInWithCredentialFromError).toHaveBeenCalledTimes(1)
  })

  it('reports an account conflict that cannot be recovered', async () => {
    const d = deps({
      link: vi.fn().mockRejectedValue(firebaseError('auth/credential-already-in-use')),
      signInWithCredentialFromError: vi.fn().mockResolvedValue(null),
    })
    await expect(continueWithGoogle(d)).rejects.toMatchObject({ code: 'unknown' })
  })

  it('signs in when there is no user yet', async () => {
    const d = deps({ user: null })
    expect(await continueWithGoogle(d)).toEqual({ kind: 'signed-in', uid: 'google-uid' })
    expect(d.signIn).toHaveBeenCalledTimes(1)
    expect(d.link).not.toHaveBeenCalled()
  })

  it.each([
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/cancelled-popup-request', 'cancelled'],
    ['auth/popup-blocked', 'popup-blocked'],
    ['auth/operation-not-allowed', 'not-enabled'],
    ['auth/unauthorized-domain', 'unauthorized-domain'],
    ['auth/network-request-failed', 'network'],
    ['auth/something-else', 'unknown'],
  ])('maps %s to %s', async (code, expected) => {
    const d = deps({ link: vi.fn().mockRejectedValue(firebaseError(code)) })
    const error = await continueWithGoogle(d).catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(GoogleAccessError)
    expect((error as GoogleAccessError).code).toBe(expected)
  })

  it('gives a message a person can act on for each failure', async () => {
    const messages = new Set<string>()
    for (const code of [
      'auth/popup-blocked',
      'auth/operation-not-allowed',
      'auth/unauthorized-domain',
      'auth/network-request-failed',
      'auth/other',
    ]) {
      const error = await continueWithGoogle(
        deps({ user: null, signIn: vi.fn().mockRejectedValue(firebaseError(code)) }),
      ).catch((failure: unknown) => failure as GoogleAccessError)
      expect((error as GoogleAccessError).message.length).toBeGreaterThan(15)
      messages.add((error as GoogleAccessError).message)
    }
    expect(messages.size).toBe(5)
  })

  it('treats a failure that is not a Firebase error as unknown', async () => {
    const d = deps({ user: null, signIn: vi.fn().mockRejectedValue('boom') })
    await expect(continueWithGoogle(d)).rejects.toMatchObject({ code: 'unknown' })
  })
})

describe('continueWithGoogle without switching accounts', () => {
  it('links normally', async () => {
    const d = deps()
    expect(await continueWithGoogle(d, { allowSwitch: false })).toEqual({
      kind: 'linked',
      uid: 'anon-uid',
    })
  })

  it('refuses to abandon the current identity when Google already knows another one', async () => {
    const d = deps({
      link: vi.fn().mockRejectedValue(firebaseError('auth/credential-already-in-use')),
      signInWithCredentialFromError: vi.fn().mockResolvedValue({ uid: 'google-uid' }),
    })
    const error = await continueWithGoogle(d, { allowSwitch: false }).catch(
      (failure: unknown) => failure,
    )
    expect(error).toBeInstanceOf(GoogleAccessError)
    expect((error as GoogleAccessError).code).toBe('account-in-use')
    expect((error as GoogleAccessError).message).toMatch(/already belongs to another profile/i)
    expect(d.signInWithCredentialFromError).not.toHaveBeenCalled()
  })
})
