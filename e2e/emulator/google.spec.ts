import { expect, test } from '@playwright/test'
import {
  createFlat,
  joinFlat,
  openTab,
  signInWithGoogleEmulator,
  uniqueEmail,
  uniqueName,
} from '../support'

test('creating a flat is gated by Google, and closing the Google window is not an error', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).click()
  await expect(page.getByText(/create your flat with google/i)).toBeVisible()
  await expect(page.getByText(/flatmates do not need google/i)).toBeVisible()

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /continue with google/i }).click(),
  ])
  await popup.close()

  // Still on the gate, ready to try again, with no error shown
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeEnabled()
  await expect(page.getByText(/could not sign in|blocked|not enabled|no connection/i)).toHaveCount(
    0,
  )
})

test('with Google already linked the gate is skipped the next time', async ({ page }) => {
  await createFlat(page, uniqueName())
  await openTab(page, 'Flat')
  await page.getByRole('button', { name: /leave this flat on this device/i }).click()
  await page.getByRole('button', { name: /create a flat/i }).click()
  await expect(page.getByLabel('Flat name')).toBeVisible()
  await expect(page.getByText(/create your flat with google/i)).toHaveCount(0)
})

test('the owner finds the flat again from a new phone with Google', async ({
  page,
  browser,
}, testInfo) => {
  const email = uniqueEmail()
  const name = uniqueName()
  await createFlat(page, name, email)

  const newPhone = await browser.newContext(testInfo.project.use)
  const second = await newPhone.newPage()
  await second.goto('/')
  await signInWithGoogleEmulator(
    second,
    () => second.getByRole('button', { name: /i already have a flat/i }).click(),
    email,
  )
  await second.getByRole('button', { name }).click()
  await expect(second.getByText(/^week \d+$/i)).toBeVisible()
  await expect(second.getByText(/Ana \(you\)/).first()).toBeVisible()
  // It is the owner: they can manage the people and the Tricount link
  await openTab(second, 'Flat')
  await expect(second.getByRole('button', { name: /add tricount link/i })).toBeVisible()
  await newPhone.close()
})

test('a new Google account finds no flats and is told what to do', async ({ page }) => {
  await page.goto('/')
  await signInWithGoogleEmulator(
    page,
    () => page.getByRole('button', { name: /i already have a flat/i }).click(),
    uniqueEmail(),
  )
  await expect(page.getByText(/did not find any flat/i)).toBeVisible()
  await expect(page.getByText(/join with the invite code/i)).toBeVisible()
})

test('a flatmate saves their access with Google and finds the flat from a new phone', async ({
  page,
  browser,
}, testInfo) => {
  const name = uniqueName()
  const code = await createFlat(page, name)

  const flatmateEmail = uniqueEmail()
  const first = await browser.newContext(testInfo.project.use)
  const old = await first.newPage()
  await joinFlat(old, code, 'Ben')
  await expect(old.getByText(name)).toBeVisible()

  // Flatmates join anonymously and are invited, not forced, to save their access
  await expect(old.getByText(/save your access/i)).toBeVisible()
  await signInWithGoogleEmulator(
    old,
    () => old.getByRole('button', { name: /link google/i }).click(),
    flatmateEmail,
  )
  await expect(old.getByText(/save your access/i)).toHaveCount(0)
  await expect(old.getByText(/Ben \(you\)/).first()).toBeVisible()

  // The old phone is gone: a new one signs in with the same Google account
  const second = await browser.newContext(testInfo.project.use)
  const fresh = await second.newPage()
  await fresh.goto('/')
  await signInWithGoogleEmulator(
    fresh,
    () => fresh.getByRole('button', { name: /i already have a flat/i }).click(),
    flatmateEmail,
  )
  await fresh.getByRole('button', { name }).click()
  await expect(fresh.getByText(/Ben \(you\)/).first()).toBeVisible()
  // A flatmate is not the owner
  await openTab(fresh, 'Flat')
  await expect(fresh.getByRole('button', { name: /add tricount link/i })).toHaveCount(0)

  await first.close()
  await second.close()
})

test('a flatmate cannot take a Google account that already belongs to another profile', async ({
  page,
  browser,
}, testInfo) => {
  const ownerEmail = uniqueEmail()
  const name = uniqueName()
  const code = await createFlat(page, name, ownerEmail)

  const context = await browser.newContext(testInfo.project.use)
  const flatmate = await context.newPage()
  await joinFlat(flatmate, code, 'Ben')
  await signInWithGoogleEmulator(
    flatmate,
    () => flatmate.getByRole('button', { name: /link google/i }).click(),
    ownerEmail,
  )
  // Switching account would lose the access to this flat, so it is explained instead
  await expect(flatmate.getByText(/already belongs to another profile/i)).toBeVisible()
  await expect(flatmate.getByText(/Ben \(you\)/).first()).toBeVisible()
  await context.close()
})
