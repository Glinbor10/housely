export interface AuthUserInfo {
  uid: string
  isAnonymous: boolean
  providerIds: string[]
  // Profile of the Google account, when there is one
  displayName?: string | null
  email?: string | null
  photoUrl?: string | null
}

export type GoogleOutcome =
  // The anonymous account became a Google account and kept its uid: nothing was lost
  | { kind: 'linked'; uid: string }
  // Signed in to a Google account the person already had (a new phone, or a known account)
  | { kind: 'signed-in'; uid: string }
  | { kind: 'already'; uid: string }

export interface GoogleAccessDeps {
  user: AuthUserInfo | null
  // Turns the current anonymous account into a Google one (linkWithPopup)
  link: () => Promise<{ uid: string }>
  // Plain Google sign-in (signInWithPopup)
  signIn: () => Promise<{ uid: string }>
  // After a link conflict: signs in with the credential carried by the error, or null if it has none
  signInWithCredentialFromError: (error: unknown) => Promise<{ uid: string } | null>
}

export type GoogleErrorCode =
  | 'cancelled'
  | 'popup-blocked'
  | 'not-enabled'
  | 'unauthorized-domain'
  | 'account-in-use'
  | 'network'
  | 'unknown'

const MESSAGES: Record<Exclude<GoogleErrorCode, 'cancelled'>, string> = {
  'popup-blocked':
    'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'not-enabled': 'Signing in with Google is not enabled for this app yet.',
  'unauthorized-domain': 'This address is not authorized for Google sign-in.',
  'account-in-use':
    'That Google account already belongs to another profile. Use a different Google account, or sign in with this one from the start screen.',
  network: 'No connection. Check your network and try again.',
  unknown: 'Could not sign in with Google. Try again.',
}

export class GoogleAccessError extends Error {
  readonly code: GoogleErrorCode

  constructor(code: GoogleErrorCode) {
    super(code === 'cancelled' ? 'Sign-in cancelled.' : MESSAGES[code])
    this.name = 'GoogleAccessError'
    this.code = code
  }
}

const CODES: Record<string, GoogleErrorCode> = {
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/popup-blocked': 'popup-blocked',
  'auth/operation-not-allowed': 'not-enabled',
  'auth/unauthorized-domain': 'unauthorized-domain',
  'auth/network-request-failed': 'network',
}

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''

const toAccessError = (error: unknown): GoogleAccessError =>
  error instanceof GoogleAccessError
    ? error
    : new GoogleAccessError(CODES[errorCode(error)] ?? 'unknown')

// Firebase provider id (not a URL): compared as a whole list entry
export const GOOGLE_PROVIDER_ID = 'google.com'

export const isGoogleUser = (user: AuthUserInfo | null): boolean =>
  user !== null && user.providerIds.some((id) => id === GOOGLE_PROVIDER_ID)

// Decides what "continue with Google" means for the person in front of the screen.
export interface GoogleAccessOptions {
  // When false, a conflict with an existing Google account is reported instead of switching to it:
  // used where abandoning the current identity would lose access to a flat just joined.
  allowSwitch?: boolean
}

export const continueWithGoogle = async (
  deps: GoogleAccessDeps,
  { allowSwitch = true }: GoogleAccessOptions = {},
): Promise<GoogleOutcome> => {
  const { user } = deps
  if (user !== null && isGoogleUser(user)) return { kind: 'already', uid: user.uid }

  try {
    if (user === null) return { kind: 'signed-in', uid: (await deps.signIn()).uid }
    try {
      return { kind: 'linked', uid: (await deps.link()).uid }
    } catch (error) {
      // Google already has an account for this person: use it instead of creating a second one
      if (errorCode(error) !== 'auth/credential-already-in-use') throw error
      if (!allowSwitch) throw new GoogleAccessError('account-in-use')
      const existing = await deps.signInWithCredentialFromError(error)
      if (existing === null) throw error
      return { kind: 'signed-in', uid: existing.uid }
    }
  } catch (error) {
    throw toAccessError(error)
  }
}
