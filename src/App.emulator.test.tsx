// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { deleteApp } from 'firebase/app'
import { terminate } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

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

describe('App', () => {
  it('creates a flat, shows this week and lets the creator mark a zone as done', async () => {
    const { default: App } = await import('./App')
    // React 19 only resumes a Suspense boundary that waits on `use` when render runs inside an async act
    await act(async () => {
      render(<App />)
    })

    await userEvent.click(
      await screen.findByRole('button', { name: /create a flat/i }, { timeout: 15000 }),
    )
    await userEvent.type(screen.getByLabelText('Flat name'), 'Integration flat')
    await userEvent.type(screen.getByLabelText('Person 1'), 'Ana')
    await userEvent.type(screen.getByLabelText('Person 2'), 'Ben')
    await userEvent.click(screen.getByRole('button', { name: /create flat/i }))

    expect(await screen.findByText('Integration flat', {}, { timeout: 15000 })).toBeTruthy()
    expect(screen.getByText(/invite code/i)).toBeTruthy()
    // With 3 zones and 2 people the creator has two zones this week
    expect(screen.getAllByText('Ana (you)').length).toBeGreaterThan(0)

    const mark = screen.getAllByRole('button', { name: /mark as done/i })
    await userEvent.click(mark[0])
    await waitFor(() => expect(screen.getAllByText(/^Done \d{4}-\d{2}-\d{2}$/)).toHaveLength(1), {
      timeout: 15000,
    })

    // The creator owns the flat, so they can add the Tricount link and it becomes an openable link
    await userEvent.click(screen.getByRole('button', { name: /add tricount link/i }))
    await userEvent.type(screen.getByLabelText('Tricount link'), 'https://tricount.com/tINTEG')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    const link = await screen.findByRole('link', { name: /open tricount/i }, { timeout: 15000 })
    expect(link.getAttribute('href')).toBe('https://tricount.com/tINTEG')
  }, 60000)

  it('opens the same flat again on the next visit', async () => {
    vi.resetModules()
    const { default: App } = await import('./App')
    // React 19 only resumes a Suspense boundary that waits on `use` when render runs inside an async act
    await act(async () => {
      render(<App />)
    })
    expect(await screen.findByText('Integration flat', {}, { timeout: 15000 })).toBeTruthy()
  }, 60000)
})
