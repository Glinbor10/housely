// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { deleteApp } from 'firebase/app'
import { signOut } from 'firebase/auth'
import { terminate } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// The Google popup is replaced by a fake credential, which the Auth emulator accepts. Everything after
// the popup (linking, switching to an existing account, the rules) is the real code.
vi.mock('./firebase/googleSignIn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./firebase/googleSignIn')>()
  const { GoogleAuthProvider, linkWithCredential, signInWithCredential } =
    await import('firebase/auth')
  const credential = () =>
    GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'integration-google', email: 'ana@example.com', email_verified: true }),
    )
  const ops = {
    linkWithPopup: async (user: Parameters<typeof linkWithCredential>[0]) =>
      (await linkWithCredential(user, credential())).user,
    signInWithPopup: async (auth: Parameters<typeof signInWithCredential>[0]) =>
      (await signInWithCredential(auth, credential())).user,
    credentialFromError: () => credential(),
    signInWithCredential: async (
      auth: Parameters<typeof signInWithCredential>[0],
      value: Parameters<typeof signInWithCredential>[1],
    ) => (await signInWithCredential(auth, value)).user,
  }
  return {
    ...actual,
    openGoogle: (auth: Parameters<typeof actual.openGoogle>[0], _ops?: unknown, options?: object) =>
      actual.openGoogle(auth, ops, options),
  }
})

// Whole app against the Auth and Firestore emulators with the production rules: `npm run test:rules`.
beforeAll(() => {
  vi.stubEnv('VITE_USE_EMULATORS', 'true')
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'demo-api-key')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo-housely.firebaseapp.com')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-housely')
  vi.stubEnv('VITE_FIREBASE_APP_ID', '1:000000000000:web:demo')
  vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '000000000000')
})

// The app keeps Firestore listeners open: close them so the next suite can clear the emulator.
afterEach(() => {
  cleanup()
})

afterAll(async () => {
  const { getFirebase } = await import('./firebase/app')
  const { app, db } = getFirebase()
  await terminate(db)
  await deleteApp(app)
})

// React 19 only resumes a Suspense boundary that waits on `use` when render runs inside an async act
const renderApp = async () => {
  const { default: App } = await import('./App')
  await act(async () => {
    render(<App />)
  })
}

describe('App', () => {
  it('creates a flat after signing in with Google, shows this week and the Tricount link', async () => {
    await renderApp()

    await userEvent.click(
      await screen.findByRole('button', { name: /create a flat/i }, { timeout: 15000 }),
    )
    // Creating a flat needs Google: the gate explains why and opens it
    expect(screen.getByText(/create your flat with google/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await userEvent.type(
      await screen.findByLabelText('Flat name', {}, { timeout: 15000 }),
      'Integration flat',
    )
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }))
    await userEvent.type(screen.getByLabelText('Person 1'), 'Ana')
    await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }))
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))

    expect(await screen.findByText('Integration flat', {}, { timeout: 15000 })).toBeTruthy()
    // With 3 zones and 2 people the creator has two zones this week
    expect(screen.getAllByText('Ana (you)').length).toBeGreaterThan(0)
    // The owner signed in with Google, so there is nothing to save
    expect(screen.queryByText(/save your access/i)).toBeNull()

    const mark = screen.getAllByRole('button', { name: /mark as done/i })
    await userEvent.click(mark[0])
    await waitFor(() => expect(screen.getAllByText(/^Done \d{4}-\d{2}-\d{2}$/)).toHaveLength(1), {
      timeout: 15000,
    })

    // The invite code lives in the People tab
    await userEvent.click(screen.getByRole('button', { name: /^people$/i }))
    expect(screen.getByText(/invite code/i)).toBeTruthy()

    // And the Tricount link in the Flat tab
    await userEvent.click(screen.getByRole('button', { name: /^flat$/i }))
    await userEvent.click(screen.getByRole('button', { name: /add tricount link/i }))
    await userEvent.type(screen.getByLabelText('Tricount link'), 'https://tricount.com/tINTEG')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    const link = await screen.findByRole('link', { name: /open tricount/i }, { timeout: 15000 })
    expect(link.getAttribute('href')).toBe('https://tricount.com/tINTEG')

    // The owner adds a person: it applies from next week, and the new person waits to join
    await userEvent.click(screen.getByRole('button', { name: /edit people and zones/i }))
    expect(screen.getByText(/this week stays as it is/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /add person/i }))
    await userEvent.type(screen.getByLabelText('Person 3'), 'Dani')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    // The editor closes when the edit is stored
    expect(
      await screen.findByRole('button', { name: /edit people and zones/i }, { timeout: 15000 }),
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^people$/i }))
    expect(
      await screen.findByText(/waiting for dani to join/i, {}, { timeout: 15000 }),
    ).toBeTruthy()
  }, 90000)

  it('opens the same flat again on the next visit', async () => {
    vi.resetModules()
    await renderApp()
    expect(await screen.findByText('Integration flat', {}, { timeout: 15000 })).toBeTruthy()
  }, 60000)

  it('finds the flat again from a new phone by signing in with Google', async () => {
    // A new phone: nothing remembered locally and a fresh anonymous identity
    const { getFirebase } = await import('./firebase/app')
    await signOut(getFirebase().auth)
    window.localStorage.clear()
    cleanup()
    vi.resetModules()
    await renderApp()

    await userEvent.click(
      await screen.findByRole('button', { name: /i already have a flat/i }, { timeout: 15000 }),
    )
    const flat = await screen.findByRole(
      'button',
      { name: /integration flat/i },
      { timeout: 15000 },
    )
    await userEvent.click(flat)
    expect(await screen.findByText(/^week \d+$/i, {}, { timeout: 15000 })).toBeTruthy()
    expect(screen.getAllByText('Ana (you)').length).toBeGreaterThan(0)
  }, 90000)
})
