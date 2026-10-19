import { expect, test } from '@playwright/test'
import { collectProblems } from './support'

test('is installable: valid manifest, reachable icons, iOS tags and a service worker', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href ?? '')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((icon: { purpose: string }) => icon.purpose)).toContain('maskable')
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true)
  }

  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  expect((await request.get(appleIcon ?? '')).ok()).toBe(true)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#[0-9a-f]{6}/i)
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  )

  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
})

test('is comfortable on a phone: 44px touch targets and no horizontal scroll', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).waitFor()
  const heights = await page
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThanOrEqual(2)
  heights.forEach((height) => expect(height).toBeGreaterThanOrEqual(44))

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('follows the dark mode of the device', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, colorScheme: 'dark' })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).waitFor()
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(background).not.toBe('rgb(255, 255, 255)')
  await context.close()
})

test('the Content-Security-Policy and the headers are in place and nothing is blocked', async ({
  page,
  request,
}) => {
  const problems = collectProblems(page)
  const response = await request.get('/')
  const headers = response.headers()
  expect(headers['content-security-policy']).toContain("default-src 'self'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['cache-control']).toMatch(/no-cache/)

  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).waitFor()
  expect(problems.filter((text) => /content security policy|refused to/i.test(text))).toEqual([])
})

test('suggests installing the app on iPhone, where Safari can delete the data, and only there', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: /create a flat/i }).waitFor()
  const hint = page.getByText(/add to home screen/i)
  if (testInfo.project.name === 'iphone') {
    await expect(hint).toBeVisible()
    await page.getByRole('button', { name: /got it/i }).click()
    await expect(hint).toHaveCount(0)
    await page.reload()
    await page.getByRole('button', { name: /create a flat/i }).waitFor()
    await expect(hint).toHaveCount(0)
  } else {
    await expect(hint).toHaveCount(0)
  }
})
