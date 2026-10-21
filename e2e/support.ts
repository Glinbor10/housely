import { expect, type Page } from '@playwright/test'

// Every console error is a finding: the Content-Security-Policy and Firebase report problems there.
export const collectProblems = (page: Page): string[] => {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('pageerror', (error) => problems.push(error.message))
  return problems
}

// Console errors that are expected and harmless: the network is cut on purpose in some tests, and
// WebKit reports Firestore's long-lived streaming requests as failed when it closes or recycles them.
// Content-Security-Policy violations and uncaught errors are never filtered.
export const isBenignNetworkNoise = (text: string): boolean =>
  /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/.test(text) ||
  /(firestore\.googleapis\.com|127\.0\.0\.1:8080)\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel/.test(
    text,
  )

export const uniqueName = (): string => `E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`

// A fixed fake Google account per test, so a second phone can sign in with the same one.
export const uniqueEmail = (): string =>
  `person-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`

// Drives the popup that the Firebase Auth emulator shows instead of Google. The real code runs: the
// app opens a real popup with the real resolver; only the identity provider behind it is simulated.
export const signInWithGoogleEmulator = async (
  page: Page,
  openPopup: () => Promise<void>,
  email: string,
): Promise<void> => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), openPopup()])

  // The app learns the result through an auth iframe that the SDK loads lazily. A real person takes
  // seconds in the Google window, but the emulator answers instantly: if the popup finished before that
  // iframe was ready the result would be lost, so the iframe is awaited first.
  const authFrame = () => page.frames().find((frame) => /\/auth\/iframe/.test(frame.url()))
  await expect.poll(() => authFrame() !== undefined, { timeout: 30_000 }).toBe(true)
  // The frame exists before the SDK has registered its listener (it still loads Google's gapi script and
  // finishes the handshake), and there is no public signal for that. A short settle time covers it.
  // (Waiting for the frame's "load" state is not an option: it can hang when the frame already loaded.)
  await page.waitForTimeout(2500)

  // The widget is ready when its list of accounts and the add button are painted: deciding earlier
  // would treat a slow render as "the account does not exist"
  const addAccount = popup.getByRole('button', { name: /add new account/i })
  await addAccount.waitFor()
  // The popup closes by itself once the sign-in is done: waiting for it makes the step deterministic
  const closed = popup.waitForEvent('close')

  // A second phone with the same account picks it from the list; a new account is created otherwise
  const existing = popup.getByText(email)
  if (await existing.count()) {
    await existing.first().click()
  } else {
    const emailField = popup.locator('#email-input')
    // The widget refreshes its list of accounts on its own: a click that lands on an element that was
    // just replaced is lost, so the click is repeated until the form shows up
    await expect(async () => {
      await addAccount.click({ timeout: 3000 })
      await expect(emailField).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 30_000 })
    await emailField.fill(email)
    await popup.locator('#display-name-input').fill('Ana Example')
    await popup.getByRole('button', { name: /sign in with google\.com/i }).click()
  }
  await closed
}

// The bottom navigation of the flat
export const openTab = async (
  page: Page,
  name: 'Week' | 'History' | 'People' | 'Flat',
): Promise<void> => {
  await page
    .getByRole('navigation', { name: /sections/i })
    .getByRole('button', { name })
    .click()
}

// Creates a flat the way a person does: with Google, then the form. Returns the invite code.
export const createFlat = async (
  page: Page,
  flatName: string,
  email: string = uniqueEmail(),
): Promise<string> => {
  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).click()
  await signInWithGoogleEmulator(
    page,
    () => page.getByRole('button', { name: /continue with google/i }).click(),
    email,
  )
  // The form has three steps: the flat, the people and the zones
  await page.getByLabel('Flat name').fill(flatName)
  await page.getByRole('button', { name: /^next$/i }).click()
  await page.getByLabel('Person 1', { exact: true }).fill('Ana')
  await page.getByLabel('Person 2', { exact: true }).fill('Ben')
  await page.getByRole('button', { name: /^next$/i }).click()
  await page.getByRole('button', { name: /create flat/i }).click()
  // The invite code lives in the People tab; the person comes back to this week afterwards
  await openTab(page, 'People')
  await page.getByText(/invite code/i).waitFor()
  const code = ((await page.locator('strong').first().textContent()) ?? '').trim()
  await openTab(page, 'Week')
  return code
}

// A flatmate joins with the code, anonymously, picking their name.
export const joinFlat = async (page: Page, code: string, name: string): Promise<void> => {
  await page.goto('/')
  await page.getByRole('button', { name: /join a flat/i }).click()
  await page.getByLabel('Invite code').fill(code.toLowerCase())
  await page.getByRole('button', { name: /continue/i }).click()
  await page.getByRole('button', { name }).click()
}
