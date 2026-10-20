import { expect, test } from '@playwright/test'
import { collectProblems, createFlat, isBenignNetworkNoise } from '../support'

const uniqueName = () => `E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`

test('a flat is created, remembered, joined from a second phone and kept in sync', async ({
  page,
  browser,
}, testInfo) => {
  const problems = collectProblems(page)
  const name = uniqueName()
  const code = await createFlat(page, name)
  expect(code).toMatch(/^[A-Z2-9]{6}$/)

  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByText(/^Done \d{4}-\d{2}-\d{2}$/).first()).toBeVisible()

  // The flat of this device opens by default next time
  await page.reload()
  await expect(page.getByText(name)).toBeVisible()

  // A second phone has its own anonymous identity and joins with the code
  const secondContext = await browser.newContext(testInfo.project.use)
  const second = await secondContext.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: /join a flat/i }).click()
  await second.getByLabel('Invite code').fill(code.toLowerCase())
  await second.getByRole('button', { name: /continue/i }).click()
  await expect(second.getByRole('button', { name: 'Ben' })).toBeVisible()
  // The creator already took their name
  await expect(second.getByRole('button', { name: 'Ana' })).toHaveCount(0)
  await second.getByRole('button', { name: 'Ben' }).click()

  await expect(second.getByText(name)).toBeVisible()
  await expect(second.getByText(/Ben \(you\)/).first()).toBeVisible()
  // What Ana marked on the first phone is visible on the second one
  await expect(second.getByText(/^Done \d{4}-\d{2}-\d{2}$/).first()).toBeVisible()

  // And the other way around, in real time
  await second
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByText(/^Done \d{4}-\d{2}-\d{2}$/)).toHaveCount(2)

  await secondContext.close()
  expect(problems.filter((text) => !isBenignNetworkNoise(text))).toEqual([])
})

test('the owner adds the Tricount link and flatmates can open it', async ({ page }) => {
  await createFlat(page, uniqueName())
  await page.getByRole('button', { name: /add tricount link/i }).click()
  await page.getByLabel('Tricount link').fill('http://tricount.com/abc')
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(page.getByText(/must start with https/i)).toBeVisible()

  await page.getByLabel('Tricount link').fill('https://tricount.com/tE2E')
  await page.getByRole('button', { name: /^save$/i }).click()
  const link = page.getByRole('link', { name: /open tricount/i })
  await expect(link).toHaveAttribute('href', 'https://tricount.com/tE2E')
  await expect(link).toHaveAttribute('target', '_blank')
})

test('a made-up invite code is rejected with a clear message', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /join a flat/i }).click()
  await page.getByLabel('Invite code').fill('ZZZZZZ')
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByText(/does not exist/i)).toBeVisible()
})

test('works offline: the flat opens from the cache and a completion is queued', async ({
  page,
  context,
}, testInfo) => {
  // WebKit does not serve a service worker offline over http://localhost (it does over https): the
  // offline app shell is covered on WebKit by deployed/mobile.spec.ts against the real hosting.
  test.skip(
    testInfo.project.name === 'iphone',
    'WebKit offline needs https, see deployed/mobile.spec.ts',
  )
  const name = uniqueName()
  await createFlat(page, name)
  // Wait until the service worker controls the page so the app shell is cached
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByText(name)).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(name)).toBeVisible()
  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByText(/^Done \d{4}-\d{2}-\d{2}$/).first()).toBeVisible()
  await context.setOffline(false)
})

test('the owner releases a flatmate who lost their phone, and they rejoin from a new one', async ({
  page,
  browser,
}, testInfo) => {
  const name = uniqueName()
  const code = await createFlat(page, name)

  const join = async () => {
    const context = await browser.newContext(testInfo.project.use)
    const phone = await context.newPage()
    await phone.goto('/')
    await phone.getByRole('button', { name: /join a flat/i }).click()
    await phone.getByLabel('Invite code').fill(code)
    await phone.getByRole('button', { name: /continue/i }).click()
    await phone.getByRole('button', { name: 'Ben' }).click()
    await expect(phone.getByText(name)).toBeVisible()
    return { context, phone }
  }

  const oldPhone = await join()
  await expect(page.getByRole('button', { name: /release ben/i })).toBeVisible()
  // The owner can never release themselves
  await expect(page.getByRole('button', { name: /release ana/i })).toHaveCount(0)

  await page.getByRole('button', { name: /release ben/i }).click()
  await expect(page.getByText(/lose access/i)).toBeVisible()
  await page.getByRole('button', { name: /yes, release/i }).click()
  await expect(page.getByText(/waiting for ben to join/i)).toBeVisible()

  // The old phone loses access. Production cuts an open listener at once; the Firestore emulator only
  // evaluates the rules when a listener is opened, so the app is reopened to see the denial.
  await oldPhone.phone.reload()
  await expect(oldPhone.phone.getByText(/not available/i)).toBeVisible()

  // A new phone gets the name back with the invite code
  const newPhone = await join()
  await expect(newPhone.phone.getByText(/Ben \(you\)/).first()).toBeVisible()

  await oldPhone.context.close()
  await newPhone.context.close()
})
