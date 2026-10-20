import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'
import sharp from 'sharp'

// Takes real screenshots of the app and composes the README hero. Usage:
//   E2E_BASE_URL=https://housely-ci.web.app npm run screenshots
// It creates one demo flat in the target environment (use the CI one, never production).
const baseURL = process.env.E2E_BASE_URL ?? 'https://housely-ci.web.app'
if (/housely-prod/.test(baseURL)) {
  throw new Error('Refusing to write demo data into production: use the CI environment')
}

const OUTPUT = 'docs/assets'
const SCREENS = `${OUTPUT}/screens`
mkdirSync(SCREENS, { recursive: true })

const browser = await chromium.launch()
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }

const shot = async (page, name) => {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SCREENS}/${name}.png` })
  console.log('captured', name)
}

// --- First phone: creates the flat ---------------------------------------------------------
const creator = await browser.newContext(phone)
const page = await creator.newPage()
await page.goto(baseURL)
await page.getByRole('button', { name: /create a flat/i }).waitFor()
await shot(page, 'welcome')

await page.getByRole('button', { name: /create a flat/i }).click()
await page.getByLabel('Flat name').fill('Calle Luna 12')
const people = ['Ana', 'Ben', 'Carla', 'Dani']
await page.getByLabel('Person 1', { exact: true }).fill(people[0])
await page.getByLabel('Person 2', { exact: true }).fill(people[1])
for (const [index, name] of people.slice(2).entries()) {
  await page.getByRole('button', { name: /add person/i }).click()
  await page.getByLabel(`Person ${index + 3}`, { exact: true }).fill(name)
}
await shot(page, 'create-flat')

await page.getByRole('button', { name: /create flat/i }).click()
await page.getByText(/invite code/i).waitFor()
const code = ((await page.locator('strong').first().textContent()) ?? '').trim()
await page
  .getByRole('button', { name: /mark as done/i })
  .first()
  .click()
await page
  .getByText(/^Done \d{4}-\d{2}-\d{2}$/)
  .first()
  .waitFor()
await shot(page, 'this-week')

await page.emulateMedia({ colorScheme: 'dark' })
await shot(page, 'this-week-dark')
await creator.close()

// --- Second phone: joins with the invite code ----------------------------------------------
const flatmate = await browser.newContext(phone)
const second = await flatmate.newPage()
await second.goto(baseURL)
await second.getByRole('button', { name: /join a flat/i }).click()
await second.getByLabel('Invite code').fill(code)
await second.getByRole('button', { name: /continue/i }).click()
await second.getByRole('button', { name: 'Ben' }).waitFor()
await shot(second, 'join')
await flatmate.close()
await browser.close()

// --- Phone mockups and the hero ------------------------------------------------------------
const WIDTH = 330
const BEZEL = 9

const framed = async (name) => {
  const { data, info } = await sharp(`${SCREENS}/${name}.png`)
    .resize({ width: WIDTH })
    .png()
    .toBuffer({ resolveWithObject: true })
  const radius = Math.round(WIDTH * 0.13)
  const mask = Buffer.from(
    `<svg width="${info.width}" height="${info.height}"><rect width="${info.width}" height="${info.height}" rx="${radius}" fill="#fff"/></svg>`,
  )
  const rounded = await sharp(data)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const outerWidth = info.width + BEZEL * 2
  const outerHeight = info.height + BEZEL * 2
  const body = Buffer.from(
    `<svg width="${outerWidth}" height="${outerHeight}"><rect width="${outerWidth}" height="${outerHeight}" rx="${radius + BEZEL}" fill="#101418"/></svg>`,
  )
  const image = await sharp(body)
    .composite([{ input: rounded, left: BEZEL, top: BEZEL }])
    .png()
    .toBuffer()
  return { image, width: outerWidth, height: outerHeight, radius: radius + BEZEL }
}

// The journey: open, create, this week, and the same screen in dark mode
const order = ['welcome', 'create-flat', 'this-week', 'this-week-dark']
const phones = await Promise.all(order.map(framed))
const GAP = 44
const MARGIN = 90
const canvasWidth = MARGIN * 2 + phones.length * phones[0].width + (phones.length - 1) * GAP
const canvasHeight = phones[0].height + 170

const background = Buffer.from(
  `<svg width="${canvasWidth}" height="${canvasHeight}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1976d2"/><stop offset="1" stop-color="#0b3d91"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${canvasWidth - 120}" cy="60" r="260" fill="#fff" opacity="0.06"/></svg>`,
)

const layers = []
for (const [index, item] of phones.entries()) {
  const left = MARGIN + index * (item.width + GAP)
  const top = index % 2 === 0 ? 110 : 60
  // A rounded shadow on a canvas bigger than the phone, so the blur is not cut at the edges
  const pad = 50
  const shadowShape = Buffer.from(
    `<svg width="${item.width + pad * 2}" height="${item.height + pad * 2}"><rect x="${pad}" y="${pad}" width="${item.width}" height="${item.height}" rx="${item.radius}" fill="#000" fill-opacity="0.45"/></svg>`,
  )
  const shadow = await sharp(shadowShape).blur(16).png().toBuffer()
  layers.push({ input: shadow, left: left - pad, top: top - pad + 26 })
  layers.push({ input: item.image, left, top })
}

await sharp(background)
  .composite(layers)
  .png({ palette: true, quality: 90 })
  .toFile(`${OUTPUT}/hero.png`)
console.log('hero composed', canvasWidth, 'x', canvasHeight)
