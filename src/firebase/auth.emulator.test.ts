import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signOut, type Auth } from 'firebase/auth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureAnonymousUser } from './auth'

// Runs against the Auth emulator: `npm run test:rules`.
let app: FirebaseApp
let auth: Auth

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-housely', apiKey: 'demo-api-key' }, 'auth-test')
  auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
})

afterAll(async () => {
  await deleteApp(app)
})

describe('ensureAnonymousUser', () => {
  it('signs in anonymously and returns the uid', async () => {
    await signOut(auth)
    const uid = await ensureAnonymousUser(auth)
    expect(uid).toMatch(/\S+/)
    expect(auth.currentUser?.isAnonymous).toBe(true)
  })

  it('reuses the current user instead of creating a new one', async () => {
    const first = await ensureAnonymousUser(auth)
    expect(await ensureAnonymousUser(auth)).toBe(first)
  })
})
