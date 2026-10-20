import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  linkWithCredential,
  signInWithCredential,
  signOut,
  signInAnonymously,
  type Auth,
} from 'firebase/auth'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GoogleAccessError, isGoogleUser } from './googleAccess'
import { openGoogle, subscribeAuthUser, type GoogleOps } from './googleSignIn'

// Runs against the Auth emulator: `npm run test:rules`. The emulator accepts fake Google
// credentials, so the real linking and sign-in logic is exercised without a popup or a real account.
let app: FirebaseApp
let auth: Auth

const fakeGoogle = (sub: string) =>
  GoogleAuthProvider.credential(
    JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true, name: `User ${sub}` }),
  )

// The popup is replaced by a credential: everything after it is the real code path
const opsFor = (sub: string): GoogleOps => ({
  linkWithPopup: async (user) => (await linkWithCredential(user, fakeGoogle(sub))).user,
  signInWithPopup: async (target) => (await signInWithCredential(target, fakeGoogle(sub))).user,
  // A fake credential carries no OAuth data for credentialFromError to read; a real popup does
  credentialFromError: () => fakeGoogle(sub),
  signInWithCredential: async (target, credential) =>
    (await signInWithCredential(target, credential)).user,
})

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-housely', apiKey: 'demo-api-key' }, 'google-test')
  auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
})

afterAll(async () => {
  await deleteApp(app)
})

beforeEach(async () => {
  await signOut(auth)
})

describe('openGoogle', () => {
  it('links an anonymous identity to Google keeping the same uid', async () => {
    const anonymous = (await signInAnonymously(auth)).user
    const outcome = await openGoogle(auth, opsFor('linker'))
    expect(outcome).toEqual({ kind: 'linked', uid: anonymous.uid })
    expect(auth.currentUser?.isAnonymous).toBe(false)
    expect(auth.currentUser?.providerData.map((provider) => provider.providerId)).toContain(
      'google.com',
    )
  })

  it('puts Google in the identities claim of the token, which is what the rules check', async () => {
    await signInAnonymously(auth)
    await openGoogle(auth, opsFor('claimer'))
    const token = await auth.currentUser!.getIdTokenResult(true)
    const firebase = token.claims.firebase as { identities: Record<string, unknown> }
    expect(Object.keys(firebase.identities)).toContain('google.com')
  })

  it('on a new phone, signs in to the account Google already knows and returns the old uid', async () => {
    const first = (await signInAnonymously(auth)).user
    await openGoogle(auth, opsFor('traveller'))
    await signOut(auth)

    await signInAnonymously(auth)
    const outcome = await openGoogle(auth, opsFor('traveller'))
    expect(outcome).toEqual({ kind: 'signed-in', uid: first.uid })
    expect(auth.currentUser?.uid).toBe(first.uid)
  })

  it('signs in directly when there is no user', async () => {
    const outcome = await openGoogle(auth, opsFor('direct'))
    expect(outcome.kind).toBe('signed-in')
    expect(auth.currentUser?.uid).toBe(outcome.uid)
  })

  it('does nothing when the person already uses Google', async () => {
    await signInAnonymously(auth)
    const linked = await openGoogle(auth, opsFor('twice'))
    expect(await openGoogle(auth, opsFor('twice'))).toEqual({ kind: 'already', uid: linked.uid })
  })

  it('explains a failure instead of leaking a Firebase error', async () => {
    await signInAnonymously(auth)
    const failing: GoogleOps = {
      ...opsFor('failing'),
      linkWithPopup: async () => {
        throw Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' })
      },
    }
    await expect(openGoogle(auth, failing)).rejects.toBeInstanceOf(GoogleAccessError)
  })
})

describe('subscribeAuthUser', () => {
  it('reports the user and its providers, and follows the link to Google', async () => {
    const seen: Array<{ anonymous: boolean; google: boolean }> = []
    const unsubscribe = subscribeAuthUser(auth, (user) => {
      if (user) seen.push({ anonymous: user.isAnonymous, google: isGoogleUser(user) })
    })
    await signInAnonymously(auth)
    await openGoogle(auth, opsFor('watcher'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    unsubscribe()
    expect(seen[0]).toEqual({ anonymous: true, google: false })
    expect(seen[seen.length - 1]).toEqual({ anonymous: false, google: true })
  })

  it('reports null when nobody is signed in', async () => {
    const values: unknown[] = []
    const unsubscribe = subscribeAuthUser(auth, (user) => values.push(user))
    await new Promise((resolve) => setTimeout(resolve, 300))
    unsubscribe()
    expect(values[values.length - 1]).toBeNull()
  })
})
