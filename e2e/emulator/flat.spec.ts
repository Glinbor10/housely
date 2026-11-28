import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../../src/i18n/en'
import {
  collectProblems,
  createFlat,
  isBenignNetworkNoise,
  joinFlat,
  openTab,
  signInWithGoogleEmulator,
  uniqueEmail,
} from '../support'

type MascotCase = 'party' | 'worried' | 'angryDebts' | 'angryWeek' | 'rest'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The bubble rotates through the lines of its case day by day, so a test accepts any of them. The
// lines of the debts tell a number of cleanings, and the single form is one more line of the case.
// A bubble that can be pressed (the debts) ends with an arrow.
const mascotSays = (kind: MascotCase) =>
  new RegExp(
    `^(?:${Object.entries(en)
      .filter(([key]) => new RegExp(`^mascot\\.say\\.${kind}(One)?(\\.\\d+)?$`).test(key))
      .map(([, text]) => escapeRegExp(text).replace('\\{n\\}', '\\d+'))
      .join('|')})(?: ›)?$`,
  )

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
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()

  // The flat of this device opens by default next time
  await page.reload()
  await expect(page.getByText(name)).toBeVisible()

  // A second phone has its own anonymous identity and joins with the code
  const secondContext = await browser.newContext(testInfo.project.use)
  const second = await secondContext.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: /join a home/i }).click()
  await second.getByLabel('Invite code').fill(code.toLowerCase())
  await second.getByRole('button', { name: /continue/i }).click()
  await expect(second.getByRole('button', { name: 'Ben' })).toBeVisible()
  // The creator already took their name
  await expect(second.getByRole('button', { name: 'Ana' })).toHaveCount(0)
  await second.getByRole('button', { name: 'Ben' }).click()
  // The joiner chooses a color before getting in: only the free ones are offered
  await expect(second.getByRole('button', { name: /^Blue$/ })).toHaveCount(0)
  await second.getByRole('button', { name: 'Pink' }).click()
  await second.getByRole('button', { name: /^join$/i }).click()

  await expect(second.getByText(name)).toBeVisible()
  await expect(second.getByText(/Ben \(you\)/).first()).toBeVisible()
  // What Ana marked on the first phone is visible on the second one
  await expect(second.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()

  // And the other way around, in real time
  await second
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u })).toHaveCount(2)

  await secondContext.close()
  expect(problems.filter((text) => !isBenignNetworkNoise(text))).toEqual([])
})

test('the owner adds the Tricount link and housemates can open it', async ({ page }) => {
  await createFlat(page, uniqueName())
  await openTab(page, 'Expenses')
  await page.getByRole('button', { name: /add tricount link/i }).click()
  await page.getByLabel('Tricount link', { exact: true }).fill('http://tricount.com/abc')
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(page.getByText(/must start with https/i)).toBeVisible()

  await page.getByLabel('Tricount link', { exact: true }).fill('https://tricount.com/tE2E')
  await page.getByRole('button', { name: /^save$/i }).click()
  const link = page.getByRole('link', { name: /open tricount/i })
  await expect(link).toHaveAttribute('href', 'https://tricount.com/tE2E')
  await expect(link).toHaveAttribute('target', '_blank')
})

test('a made-up invite code is rejected with a clear message', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /join a home/i }).click()
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
  // It says so once, and that what is done is kept
  await expect(page.getByRole('status').filter({ hasText: /no connection/i })).toBeVisible()
  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('status').filter({ hasText: /no connection/i })).toHaveCount(0)
})

test('the back button goes to the previous section and closes the views that were opened', async ({
  page,
}) => {
  await createFlat(page, uniqueName())
  await openTab(page, 'History')
  await openTab(page, 'People')
  await openTab(page, 'Expenses')
  await expect(page.getByRole('heading', { name: /^expenses$/i })).toBeVisible()

  // Back closes the expenses, not the app
  await page.goBack()
  await expect(page.getByRole('heading', { name: /^expenses$/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^expenses/i })).toBeVisible()
  // ...then goes to the section before, and to the first one
  await page.goBack()
  await expect(page.getByRole('button', { name: /^list$/i })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: /mark as done/i }).first()).toBeVisible()

  // Forward brings the places back, one by one
  await page.goForward()
  await page.goForward()
  await page.goForward()
  await expect(page.getByRole('heading', { name: /^expenses$/i })).toBeVisible()
})

test('the owner releases a housemate who lost their phone, and they rejoin from a new one', async ({
  page,
  browser,
}, testInfo) => {
  const name = uniqueName()
  const code = await createFlat(page, name)

  const join = async () => {
    const context = await browser.newContext(testInfo.project.use)
    const phone = await context.newPage()
    await phone.goto('/')
    await phone.getByRole('button', { name: /join a home/i }).click()
    await phone.getByLabel('Invite code').fill(code)
    await phone.getByRole('button', { name: /continue/i }).click()
    await phone.getByRole('button', { name: 'Ben' }).click()
    await phone.getByRole('button', { name: /^join$/i }).click()
    await expect(phone.getByText(name)).toBeVisible()
    return { context, phone }
  }

  const oldPhone = await join()
  await openTab(page, 'People')
  await expect(page.getByRole('button', { name: /options for ben/i })).toBeVisible()
  // The owner can never release themselves
  await expect(page.getByRole('button', { name: /options for ana/i })).toHaveCount(0)

  await page.getByRole('button', { name: /options for ben/i }).click()
  await page.getByRole('menuitem', { name: /release ben/i }).click()
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

test('every section fits the phone: no horizontal scroll and no layout shift', async ({ page }) => {
  // Layout shifts are recorded from the very first paint
  await page.addInitScript(() => {
    ;(window as unknown as { shifts: number }).shifts = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) (window as unknown as { shifts: number }).shifts += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await createFlat(page, uniqueName())

  for (const tab of ['Week', 'History', 'People', 'Expenses', 'Settings'] as const) {
    await openTab(page, tab)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, `${tab} scrolls sideways`).toBeLessThanOrEqual(0)
  }

  // 0.1 is the limit Google calls "good" for Cumulative Layout Shift
  const shifts = await page.evaluate(() => (window as unknown as { shifts: number }).shifts)
  expect(shifts).toBeLessThan(0.1)
})

test('no screen has accessibility violations (axe, WCAG 2 A and AA)', async ({ page }) => {
  const check = async (screen: string) => {
    // Cards fade in: measured halfway, their text would look paler than it is
    await page.waitForTimeout(1200)
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const summary = result.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => `${node.target} (${node.any[0]?.message})`).join(' | ')}`,
    )
    expect(summary, `${screen} has violations`).toEqual([])
  }

  await page.goto('/')
  await page.getByRole('button', { name: /create a home/i }).waitFor()
  await check('welcome')

  await createFlat(page, uniqueName())
  await check('week')
  await openTab(page, 'History')
  await check('history calendar')
  await page.getByRole('button', { name: /^list$/i }).click()
  await check('history list')
  await openTab(page, 'People')
  await check('people')
  await page.getByRole('button', { name: /edit people and zones/i }).click()
  await check('rotation editor')
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await page.getByRole('button', { name: /rename home/i }).click()
  await check('rename home')
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await openTab(page, 'Expenses')
  await check('expenses')
  await openTab(page, 'Settings')
  await check('settings')

  // The same screens with the dark palette, where contrast is easiest to get wrong
  await page.emulateMedia({ colorScheme: 'dark' })
  await openTab(page, 'Week')
  await check('week in dark mode')
  await openTab(page, 'History')
  await page.getByRole('button', { name: /^calendar$/i }).click()
  await check('history calendar in dark mode')
})

test('the history shows what was done and counts it per person', async ({ page }) => {
  await createFlat(page, uniqueName())
  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()

  await openTab(page, 'History')
  // It opens on the calendar: today shows who cleaned what, in the color of the person
  await expect(page.getByRole('button', { name: /Ana \(.+\)/ })).toBeVisible()
  await page.getByRole('button', { name: /^list$/i }).click()
  await expect(
    page.getByRole('heading', { name: /^Week \d{1,2} \p{L}+\.?[–-]\d{1,2} \p{L}+\.?$/u }),
  ).toBeVisible()
  await expect(
    page.getByRole('listitem', { name: 'Ana' }).getByText(/^1 of \d+ done$/),
  ).toBeVisible()
  // Nothing is missed in the very first week: it is still in progress
  await expect(page.getByText('Missed')).toHaveCount(0)
})

test('the owner adds a person from the settings and the new person waits to join', async ({
  page,
}) => {
  await createFlat(page, uniqueName())
  await openTab(page, 'People')
  await page.getByRole('button', { name: /edit people and zones/i }).click()
  await expect(page.getByText(/this week stays as it is/i)).toBeVisible()
  await page.getByRole('button', { name: /add person/i }).click()
  await page.getByLabel('Person 3', { exact: true }).fill('Dani')
  await page.getByRole('button', { name: /^save$/i }).click()

  // The editor closes once the edit is stored, and the new person shows up in the People tab
  await expect(page.getByRole('button', { name: /edit people and zones/i })).toBeVisible()
  await openTab(page, 'People')
  await expect(page.getByText(/waiting for dani to join/i)).toBeVisible()
  // The week that is running was not touched
  await openTab(page, 'Week')
  await expect(page.getByText(/Ana \(you\)/).first()).toBeVisible()
})

test('Housy gets angry with who left their own zone undone in a finished week', async ({
  page,
}) => {
  // A flat that started three weeks ago: the zones of the first weeks were never done
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  const iso = `${threeWeeksAgo.getFullYear()}-${String(threeWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(threeWeeksAgo.getDate()).padStart(2, '0')}`
  await createFlat(page, uniqueName(), undefined, iso)
  await expect(page.getByRole('img', { name: /housy the mascot, angry/i })).toBeVisible()
  // The anger comes from the debt of a finished week, so Housy asks to settle it
  await expect(page.getByTestId('mascot-bubble')).toHaveText(mascotSays('angryDebts'))
})

test('a person picks their own color and the calendar shows it', async ({ page }) => {
  await createFlat(page, uniqueName())
  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()

  await openTab(page, 'People')
  // The colors are hidden until the pencil of the own avatar is pressed, and only the free ones show
  await expect(page.getByRole('button', { name: 'Pink' })).toHaveCount(0)
  await page.getByRole('button', { name: /change your color/i }).click()
  await expect(page.getByRole('button', { name: /^Green$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pink' }).click()
  // The choice closes, and the color that was left is free again for the next time
  await expect(page.getByRole('button', { name: 'Pink' })).toHaveCount(0)
  await page.getByRole('button', { name: /change your color/i }).click()
  await expect(page.getByRole('button', { name: /^Blue$/ })).toBeEnabled()
  await page.getByRole('button', { name: /change your color/i }).click()

  await openTab(page, 'History')
  const mark = page.getByRole('button', { name: /Ana \(.+\)/ }).getByText('A')
  await expect(mark).toHaveCSS('background-color', 'rgb(194, 24, 91)')
})

test('the owner renames the flat and who joins afterwards sees the new name', async ({
  page,
  browser,
}, testInfo) => {
  const code = await createFlat(page, uniqueName())
  await openTab(page, 'People')
  await page.getByRole('button', { name: /rename home/i }).click()
  await page.getByLabel('Home name').fill('Casa Sol')
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(page.getByRole('heading', { name: 'Casa Sol' })).toBeVisible()

  const context = await browser.newContext(testInfo.project.use)
  const housemate = await context.newPage()
  await housemate.goto('/')
  await housemate.getByRole('button', { name: /join a home/i }).click()
  await housemate.getByLabel('Invite code').fill(code.toLowerCase())
  await housemate.getByRole('button', { name: /continue/i }).click()
  await expect(housemate.getByText('Joining Casa Sol')).toBeVisible()
  await context.close()
})

test('the owner hands the flat over to a housemate, who becomes the owner', async ({
  page,
  browser,
}, testInfo) => {
  const code = await createFlat(page, uniqueName())
  const context = await browser.newContext(testInfo.project.use)
  const housemate = await context.newPage()
  await joinFlat(housemate, code, 'Ben')
  await expect(housemate.getByText(/Ben \(you\)/).first()).toBeVisible()
  // A housemate has none of the tools of the owner
  await openTab(housemate, 'People')
  await expect(housemate.getByRole('button', { name: /options for/i })).toHaveCount(0)

  // Ben joined without Google: if he lost his phone nobody could manage the flat, so he cannot be the owner yet
  await openTab(page, 'People')
  await page.getByRole('button', { name: /options for ben/i }).click()
  await page.getByRole('menuitem', { name: /make owner of the home/i }).click()
  await expect(page.getByText(/must link a google account in settings/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /yes, make owner/i })).toHaveCount(0)
  await page.getByRole('button', { name: /^close$/i }).click()

  // Ben links Google from Settings, and the owner sees that he can be made owner
  await openTab(housemate, 'Settings')
  await signInWithGoogleEmulator(
    housemate,
    () =>
      housemate
        .getByRole('button', { name: /^link google$/i })
        .first()
        .click(),
    uniqueEmail(),
  )
  await expect(async () => {
    await page.getByRole('button', { name: /options for ben/i }).click()
    await page.getByRole('menuitem', { name: /make owner of the home/i }).click()
    const confirm = page.getByRole('button', { name: /yes, make owner/i })
    try {
      await confirm.waitFor({ state: 'visible', timeout: 2000 })
    } catch {
      // The mark of Ben has not arrived yet: close the dialog so the next try can open it again
      await page.getByRole('button', { name: /^close$/i }).click()
      throw new Error('Ben does not have the Google mark yet')
    }
  }).toPass({ timeout: 30_000 })
  await expect(page.getByText(/only Ben could give it back/)).toBeVisible()
  await page.getByRole('button', { name: /yes, make owner/i }).click()

  // The old owner loses the tools at once; the new one has them when the flat is opened again
  await expect(page.getByRole('button', { name: /edit people and zones/i })).toHaveCount(0)
  await housemate.reload()
  await openTab(housemate, 'People')
  await expect(housemate.getByRole('button', { name: /edit people and zones/i })).toBeVisible()
  await context.close()
})

// A YYYY-MM-DD date some whole days ago, to start a flat at a chosen point of its week.
const isoDaysAgo = (daysAgo: number): string => {
  const day = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
// The weeks of a flat count from the day it starts, not from a Monday. The flats of these tests start a
// week ago: the first week began that day and the second one, today, is the running week.
const startDaysAgo = (daysAgo: number): Date => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
// How the app tells a day: 19 Oct
const dayShort = (day: Date): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(day)
// How the calendar names a day (the page is in English)
const dayName = (day: Date): string =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long' }).format(day)

test('the group settles the zones that nobody cleaned, and Housy calms down', async ({ page }) => {
  // A flat that started a week ago: the three zones of the first week were never done. With two
  // people, Ana had two of them and Ben one.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const iso = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
  await createFlat(page, uniqueName(), undefined, iso)
  await expect(page.getByRole('img', { name: /housy the mascot, angry/i })).toBeVisible()

  // The zones to settle are under the calendar
  const firstWeek = dayShort(startDaysAgo(7))
  await openTab(page, 'History')
  // Only who owes a zone settles it: Ben's Kitchen has no button for Ana, only who has to
  await expect(page.getByRole('button', { name: /settle kitchen/i })).toHaveCount(0)
  await expect(page.getByText('Ben has to settle it')).toBeVisible()

  // Not at home, with a note that everybody can read
  await page
    .getByRole('button', {
      name: new RegExp(`settle living room of the week of ${firstWeek}`, 'i'),
    })
    .click()
  await page.getByRole('button', { name: /not at home/i }).click()
  await page.getByLabel(/note/i).fill('We were all away')
  await page.getByRole('button', { name: /^save$/i }).click()
  // The form closes when the settlement is stored: until then the note is in two places
  await expect(
    page.getByRole('group', { name: new RegExp(`living room, week of ${firstWeek}`, 'i') }),
  ).toHaveCount(0)
  await expect(page.getByText('Not at home', { exact: true })).toBeVisible()
  await expect(page.getByText('We were all away')).toBeVisible()
  // Ana owed it and settled it herself: it does not say so
  await expect(page.getByText(/settled by/i)).toHaveCount(0)

  // Making up with a cleaning of Ben: the open form must be accessible too
  await page
    .getByRole('button', { name: new RegExp(`settle bathroom of the week of ${firstWeek}`, 'i') })
    .click()
  await page.getByRole('button', { name: /make up with another cleaning/i }).click()
  // The week is found on a calendar: the running one. Then comes the cleaning of that week, and a last look
  await page.getByRole('button', { name: dayName(startDaysAgo(0)), exact: true }).click()
  await page.getByRole('button', { name: 'Bathroom (Ben)' }).click()
  await expect(page.getByText(/you will do the bathroom of ben/i)).toBeVisible()
  await page.waitForTimeout(800)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => `${node.target} (${node.any[0]?.message ?? node.all[0]?.message})`).join(' | ')}`,
    ),
  ).toEqual([])
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(
    page.getByRole('group', { name: new RegExp(`bathroom, week of ${firstWeek}`, 'i') }),
  ).toHaveCount(0)
  await expect(page.getByText(`Made up with Bathroom (${dayShort(startDaysAgo(0))})`)).toBeVisible()

  // Ana has nothing left undone: Housy is not angry any more, but sad, because Ben's zone is
  // The settle section is tall enough to span the fixed nav bar's y-coordinates; clicking the Week
  // button via evaluate() bypasses Playwright's pointer-event intercept check on a position:fixed nav
  await page
    .getByRole('navigation', { name: /sections/i })
    .getByRole('button', { name: 'Week' })
    .evaluate((button) => (button as HTMLElement).click())
  await expect(page.getByRole('img', { name: /housy the mascot, angry/i })).toHaveCount(0)
  await expect(page.getByRole('img', { name: /housy the mascot, sad/i })).toBeVisible()

  // Ana does both of her zones this week, the one she took too: the calendar shows it on her day
  for (let left = 2; left > 0; left -= 1) {
    await page
      .getByRole('button', { name: /mark as done/i })
      .first()
      .click()
    await expect(page.getByRole('button', { name: /mark as done/i })).toHaveCount(left - 1)
  }
  await openTab(page, 'History')
  await page.getByRole('button', { name: /^calendar$/i }).click()
  await expect(page.getByRole('button', { name: /Ana \(Bathroom\)/ })).toBeVisible()

  // Undoing brings the zone back as missed
  // The last rows of the page can end behind the bar of sections, which is fixed to the bottom: the button
  // is brought to the middle of the screen and then pressed without the check of what is over it
  const undoSettlement = page.getByRole('button', {
    name: new RegExp(`undo the settlement of living room of the week of ${firstWeek}`, 'i'),
  })
  await undoSettlement.evaluate((button) => button.scrollIntoView({ block: 'center' }))
  await undoSettlement.click({ force: true })
  await expect(
    page.getByRole('button', {
      name: new RegExp(`settle living room of the week of ${firstWeek}`, 'i'),
    }),
  ).toBeVisible()
})

test('Housy worries during the last three days of the flat week', async ({ page }) => {
  // The flat started four days ago: the fifth day of its first week, with every zone still pending
  await createFlat(page, uniqueName(), undefined, isoDaysAgo(4))
  await expect(page.getByRole('img', { name: /housy the mascot, worried/i })).toBeVisible()
  await expect(page.getByTestId('mascot-bubble')).toHaveText(mascotSays('worried'))
})

test('Housy gets angry on the last day when your own zones are still pending', async ({ page }) => {
  // Six days ago: the last day of the first week. With two people, Ana has two of the three zones
  await createFlat(page, uniqueName(), undefined, isoDaysAgo(6))
  await expect(page.getByRole('img', { name: /housy the mascot, angry/i })).toBeVisible()
  await expect(page.getByTestId('mascot-bubble')).toHaveText(mascotSays('angryWeek'))
  // This anger is about today, not about the debt of a finished week
  await expect(page.getByTestId('mascot-bubble')).not.toHaveText(mascotSays('angryDebts'))
})

test('the back button closes the dialogs and forms that are open before it leaves the screen', async ({
  page,
}) => {
  await createFlat(page, uniqueName())
  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()

  // The dialog of the date: back closes it and the person stays in the week
  await page.getByRole('button', { name: /change the date or undo/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u }).first()).toBeVisible()
  // ...and it can be opened again, and closed with its own button
  await page.getByRole('button', { name: /change the date or undo/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // The form of an expense: back closes the form first, then the expenses
  await openTab(page, 'People')
  await openTab(page, 'Expenses')
  await page.getByRole('button', { name: /add expense/i }).click()
  await expect(page.getByLabel(/amount/i)).toBeVisible()
  await page.goBack()
  await expect(page.getByLabel(/amount/i)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /^expenses$/i })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: /^expenses$/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^expenses/i })).toBeVisible()
})

test('a person keeps several flats on the device and switches between them', async ({ page }) => {
  const first = uniqueName()
  const second = `${uniqueName()} B`
  await createFlat(page, first)

  // Changing flat can be given up: the person goes back to the one that was open
  await openTab(page, 'Settings')
  await page.getByRole('button', { name: /^change home$/i }).click()
  await page.getByRole('button', { name: /back to my home/i }).click()
  await expect(page.getByRole('heading', { name: first })).toBeVisible()

  // ...or it is created, and the first one is kept
  await openTab(page, 'Settings')
  await page.getByRole('button', { name: /^change home$/i }).click()
  await page.getByRole('button', { name: /create a home/i }).click()
  await page.getByLabel('Home name').fill(second)
  await page.getByRole('button', { name: /^next$/i }).click()
  await page.getByLabel('Person 1', { exact: true }).fill('Ana')
  await page.getByLabel('Person 2', { exact: true }).fill('Ben')
  await page.getByRole('button', { name: /^next$/i }).click()
  await page.getByRole('button', { name: /create home/i }).click()
  await expect(page.getByRole('heading', { name: second })).toBeVisible()

  await openTab(page, 'Settings')
  await page.getByRole('button', { name: /^change home$/i }).click()
  await expect(page.getByRole('button', { name: `Open ${second}` })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await page.getByRole('button', { name: `Open ${first}` }).click()
  await expect(page.getByRole('heading', { name: first })).toBeVisible()

  // The flat that was open is the one that opens next time
  await page.reload()
  await expect(page.getByRole('heading', { name: first })).toBeVisible()
})

test('logging out forgets the flats of the device and goes back to the start', async ({ page }) => {
  await createFlat(page, uniqueName())
  await openTab(page, 'Settings')
  // It is asked first, and giving up leaves everything as it was
  await page.getByRole('button', { name: /^log out$/i }).click()
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await expect(page.getByRole('button', { name: /^log out$/i })).toBeVisible()

  await page.getByRole('button', { name: /^log out$/i }).click()
  await page.getByRole('button', { name: /yes, log out/i }).click()
  await expect(page.getByRole('button', { name: /join a home/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^change home$/i })).toHaveCount(0)

  // Nothing is remembered on the next visit either
  await page.reload()
  await expect(page.getByRole('button', { name: /join a home/i })).toBeVisible()
})

test('a cleaning marked as done by mistake can be undone', async ({ page }) => {
  await createFlat(page, uniqueName())
  await page
    .getByRole('button', { name: /mark as done/i })
    .first()
    .click()
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u })).toHaveCount(1)

  // The pencil opens a dialog: the card does not grow
  await page.getByRole('button', { name: /change the date or undo/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^undo .* marked as done$/i }).click()
  // It asks first, and giving up leaves it done
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await expect(page.getByRole('button', { name: /yes, undo/i })).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('button', { name: /^undo .* marked as done$/i }).click()
  await page.getByRole('button', { name: /yes, undo/i }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /^Done \d{1,2} \p{L}+\.?$/u })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /mark as done/i }).first()).toBeVisible()
})

test('a person makes up a missed zone by taking a cleaning of a housemate', async ({ page }) => {
  // A flat that started a week ago: with two people, Ana had two zones of the first week and Ben one
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const iso = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
  await createFlat(page, uniqueName(), undefined, iso)
  // Ana has one zone this week
  await expect(page.getByRole('button', { name: /mark as done/i })).toHaveCount(1)

  const firstWeek = dayShort(startDaysAgo(7))
  await openTab(page, 'History')
  const settleButton = page.getByRole('button', {
    name: new RegExp(`settle living room of the week of ${firstWeek}`, 'i'),
  })
  // The form to settle is closed by the back button, without leaving the history
  await settleButton.click()
  await expect(page.getByRole('group', { name: /living room, week of/i })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('group', { name: /living room, week of/i })).toHaveCount(0)
  await expect(settleButton).toBeVisible()

  // The steps are places of the history too: back goes back one step and then leaves
  await settleButton.click()
  await page.getByRole('button', { name: /make up with another cleaning/i }).click()
  await expect(page.getByText('Step 2 of 4')).toBeVisible()
  await page.goBack()
  await expect(page.getByText('How do you settle it?')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('group', { name: /living room, week of/i })).toHaveCount(0)

  await settleButton.click()
  await page.getByRole('button', { name: /make up with another cleaning/i }).click()
  await page.getByRole('button', { name: dayName(startDaysAgo(0)), exact: true }).click()
  await page.getByRole('button', { name: 'Living room (Ben)' }).click()
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(
    page.getByRole('group', { name: new RegExp(`living room, week of ${firstWeek}`, 'i') }),
  ).toHaveCount(0)
  await expect(
    page.getByText(`Made up with Living room (${dayShort(startDaysAgo(0))})`),
  ).toBeVisible()
  // The list is only a summary, and says where the cleaning that was taken comes from
  await page.getByRole('button', { name: /^list$/i }).click()
  await expect(
    page.getByText(new RegExp(`Instead of Ben: makes up week ${firstWeek}`)),
  ).toBeVisible()

  // Ana has two zones this week now, and it says where the new one comes from
  await openTab(page, 'Week')
  await expect(page.getByRole('button', { name: /mark as done/i })).toHaveCount(2)
  await expect(page.getByText('Instead of Ben')).toBeVisible()
  await expect(page.getByText(new RegExp(`Makes up the week of ${firstWeek} to `))).toBeVisible()

  // Undoing gives the zone back to Ben and the debt is missed again
  await openTab(page, 'History')
  const undoMakeUp = page.getByRole('button', {
    name: new RegExp(`undo the settlement of living room of the week of ${firstWeek}`, 'i'),
  })
  await undoMakeUp.evaluate((button) => button.scrollIntoView({ block: 'center' }))
  await undoMakeUp.click({ force: true })
  await expect(
    page.getByRole('button', {
      name: new RegExp(`settle living room of the week of ${firstWeek}`, 'i'),
    }),
  ).toBeVisible()
  await openTab(page, 'Week')
  await expect(page.getByRole('button', { name: /mark as done/i })).toHaveCount(1)
})

test('housemates share expenses, see who owes whom and settle up', async ({
  page,
  browser,
}, testInfo) => {
  const name = uniqueName()
  const code = await createFlat(page, name)

  // Ana writes an expense that she paid for the two of them
  await openTab(page, 'Expenses')
  await page.getByRole('button', { name: /add expense/i }).click()
  await page.getByLabel(/what was it for/i).fill('Groceries')
  await page.getByLabel(/amount/i).fill('30,50')
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible()
  await expect(page.getByText('€30.50').first()).toBeVisible()
  await expect(page.getByText('Ana is owed €15.25')).toBeVisible()
  await expect(page.getByText('Ben owes €15.25')).toBeVisible()

  // Ben joins from another phone: he sees it, cannot change it and pays Ana back
  const benContext = await browser.newContext(testInfo.project.use)
  const ben = await benContext.newPage()
  await joinFlat(ben, code, 'Ben')
  await openTab(ben, 'Expenses')
  await expect(ben.getByText(/you owe/i)).toBeVisible()
  await expect(ben.getByRole('heading', { name: 'Groceries' })).toBeVisible()
  await expect(ben.getByRole('button', { name: /edit groceries/i })).toHaveCount(0)
  await expect(ben.getByRole('button', { name: /delete groceries/i })).toHaveCount(0)
  await ben.getByRole('button', { name: /mark as paid/i }).click()
  await expect(ben.getByText('Everything is settled')).toBeVisible()

  // Ana sees it settled, in real time, and can still edit her own expense
  await expect(page.getByText('Everything is settled')).toBeVisible()
  await page.getByRole('button', { name: /edit groceries/i }).click()
  await page.getByLabel(/amount/i).fill('40')
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(page.getByText('Ben owes €4.75')).toBeVisible()

  // The accessibility of the view, once the buttons stop changing (a button that is busy fades to its
  // disabled color, and axe would read the colors in between)
  await expect(page.getByRole('button', { name: /mark as paid/i })).toBeEnabled()
  await page.waitForTimeout(600)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => `${node.target} (${node.any[0]?.message ?? node.all[0]?.message})`).join(' | ')}`,
    ),
  ).toEqual([])

  // Ana deletes the expense after being asked
  await page.getByRole('button', { name: /delete groceries/i }).click()
  await page.getByRole('button', { name: /yes, delete/i }).click()
  await expect(page.getByRole('heading', { name: 'Groceries' })).toHaveCount(0)
  await benContext.close()
})

test('the name of the home opens a menu to switch home, or to create or join another', async ({
  page,
}) => {
  const name = uniqueName()
  await createFlat(page, name)
  await page.getByRole('button', { name: /show my homes/i }).click()
  // The home that is open is marked, and creating goes straight to the form: the person has Google
  await expect(page.getByRole('menuitem', { name })).toBeVisible()
  await expect(page.getByRole('menuitem', { name })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('menuitem', { name: /^join a home$/i })).toBeVisible()
  await page.getByRole('menuitem', { name: /^create a home$/i }).click()
  await expect(page.getByLabel('Home name')).toBeVisible()
})
