import { expect, test } from '@playwright/test'
import { createFlat, joinFlat, openTab, uniqueName } from '../support'

test('the owner deletes the home for good and a housemate can leave it', async ({
  page,
  browser,
}, testInfo) => {
  const name = uniqueName()
  const code = await createFlat(page, name)

  const context = await browser.newContext(testInfo.project.use)
  const housemate = await context.newPage()
  await joinFlat(housemate, code, 'Ben')
  await expect(housemate.getByText(name)).toBeVisible()

  // Only the owner can delete the home
  await openTab(housemate, 'Settings')
  await expect(housemate.getByRole('button', { name: /^delete home$/i })).toHaveCount(0)
  await openTab(housemate, 'Week')

  // It asks for the name and says that it cannot be undone
  await openTab(page, 'Settings')
  await page.getByRole('button', { name: /^delete home$/i }).click()
  await expect(page.getByText(/cannot be undone/i)).toBeVisible()
  const confirm = page.getByRole('button', { name: /delete for good/i })
  await expect(confirm).toBeDisabled()
  await page.getByLabel(/type the name/i).fill(name)
  await confirm.click()

  // The home is gone from the device of the owner, who is back at the start
  await expect(page.getByRole('button', { name: /create a home/i })).toBeVisible()
  await expect(page.getByRole('button', { name })).toHaveCount(0)

  // The housemate sees that the home is not available any more, and can leave it on the device
  await expect(housemate.getByText(/not available any more/i)).toBeVisible()
  await housemate.getByRole('button', { name: /leave this home on this device/i }).click()
  await expect(housemate.getByRole('button', { name: /join a home/i })).toBeVisible()

  // The invite code does not find anything any more
  await housemate.getByRole('button', { name: /join a home/i }).click()
  await housemate.getByLabel('Invite code').fill(code.toLowerCase())
  await housemate.getByRole('button', { name: /continue/i }).click()
  await expect(housemate.getByRole('button', { name: 'Ben' })).toHaveCount(0)

  await context.close()
})
