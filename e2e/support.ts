import type { Page } from '@playwright/test'

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
  /firestore\.googleapis\.com\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel/.test(text)

export const createFlat = async (page: Page, flatName: string): Promise<string> => {
  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).click()
  await page.getByLabel('Flat name').fill(flatName)
  await page.getByLabel('Person 1', { exact: true }).fill('Ana')
  await page.getByLabel('Person 2', { exact: true }).fill('Ben')
  await page.getByRole('button', { name: /create flat/i }).click()
  await page.getByText(/invite code/i).waitFor()
  return ((await page.locator('strong').first().textContent()) ?? '').trim()
}
