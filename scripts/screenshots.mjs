import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'
import sharp from 'sharp'
import { createFlat, openTab } from '../e2e/support.ts'

// Takes real screenshots of the app and composes the README hero. Usage: npm run screenshots
// It runs the app against the local Firebase emulators (see the npm script), so it never writes
// demo data anywhere real and can sign in with the simulated Google popup.
const baseURL = 'http://localhost:4173'
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  shell: true,
  stdio: 'ignore',
})
const stopPreview = () => preview.kill()
process.on('exit', stopPreview)
for (let attempt = 0; attempt < 60; attempt += 1) {
  const ready = await fetch(baseURL).then(
    (response) => response.ok,
    () => false,
  )
  if (ready) break
  await new Promise((resolve) => setTimeout(resolve, 500))
}

const OUTPUT = 'docs/assets'
const SCREENS = `${OUTPUT}/screens`
mkdirSync(SCREENS, { recursive: true })

const browser = await chromium.launch()
const phone = {
  ...devices['Pixel 7'],
  locale: 'en-US',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
}

const shot = async (page, name) => {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SCREENS}/${name}.png` })
  console.log('captured', name)
}

// --- First phone: creates the flat ---------------------------------------------------------
const creator = await browser.newContext({ ...phone, baseURL })
const page = await creator.newPage()
await page.goto('/')
await page.getByRole('button', { name: /create a flat/i }).waitFor()
await shot(page, 'welcome')

const code = await createFlat(page, 'Calle Luna 12')
await page
  .getByRole('button', { name: /mark as done/i })
  .first()
  .click()
await page
  .getByText(/^Done \d{4}-\d{2}-\d{2}$/)
  .first()
  .waitFor()
await shot(page, 'this-week')

await openTab(page, 'People')
await shot(page, 'people')
await openTab(page, 'Week')

await page.emulateMedia({ colorScheme: 'dark' })
await shot(page, 'this-week-dark')
await creator.close()

// --- Second phone: joins with the invite code ----------------------------------------------
const flatmate = await browser.newContext({ ...phone, baseURL })
const second = await flatmate.newPage()
await second.goto('/')
await second.getByRole('button', { name: /join a flat/i }).click()
await second.getByLabel('Invite code').fill(code)
await second.getByRole('button', { name: /continue/i }).click()
await second.getByRole('button', { name: 'Ben' }).waitFor()
await shot(second, 'join')
await flatmate.close()
await browser.close()
stopPreview()

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

// The journey: open, this week, people, and the same screen in dark mode
const order = ['welcome', 'this-week', 'people', 'this-week-dark']
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
