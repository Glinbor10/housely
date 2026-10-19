import { getFirebase } from '../firebase/app'
import { ensureAnonymousUser } from '../firebase/auth'

export type AuthResult = { uid: string; error?: undefined } | { uid?: undefined; error: Error }

let pending: Promise<AuthResult> | undefined

// One sign-in per page load, shared by every consumer. Failures are values, not rejections, so
// React's `use` never throws and the gate can render a message.
export const getAuthResult = (): Promise<AuthResult> =>
  (pending ??= ensureAnonymousUser(getFirebase().auth).then(
    (uid) => ({ uid }),
    (error: unknown) => ({ error: error instanceof Error ? error : new Error(String(error)) }),
  ))
