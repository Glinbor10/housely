import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'
import { signInWithGoogleEmulator } from '../e2e/support.ts'

// Takes the screenshots of the user guide, in Spanish, from the real app, into docs/assets/guide (not versioned).
// Usage: npm run screenshots:guide
// It runs against the local Firebase emulators loaded with scripts/seed.mjs (see the npm script), so it
// never writes anywhere real. A new home is created and joined from scratch, and the demo home of Carla
// shows the screens that need a history and expenses.
const baseURL = 'http://localhost:4173'
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  shell: true,
  stdio: 'ignore',
})
// With a shell, killing the child is not enough on Windows: the whole process tree has to go
const stopPreview = () =>
  process.platform === 'win32'
    ? spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore' })
    : preview.kill()
process.on('exit', stopPreview)
for (let attempt = 0; attempt < 60; attempt += 1) {
  const ready = await fetch(baseURL).then(
    (response) => response.ok,
    () => false,
  )
  if (ready) break
  await new Promise((resolve) => setTimeout(resolve, 500))
}

const OUTPUT = 'docs/assets/guide'
mkdirSync(OUTPUT, { recursive: true })

const browser = await chromium.launch()
const phone = {
  ...devices['Pixel 7'],
  locale: 'es-ES',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
}

const shot = async (page, name) => {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUTPUT}/${name}.png` })
  console.log('captured', name)
}
const openTab = (page, name) =>
  page
    .getByRole('navigation', { name: /secciones/i })
    .getByRole('button', { name })
    .click()

// --- Create a home ---------------------------------------------------------------------------
const owner = await browser.newContext({ ...phone, baseURL })
const page = await owner.newPage()
await page.goto('/')
await page.getByRole('button', { name: /crear un hogar/i }).waitFor()
await shot(page, '01-bienvenida')

await page.getByRole('button', { name: /crear un hogar/i }).click()
await page.getByRole('button', { name: /continuar con google/i }).waitFor()
await shot(page, '02-crear-google')
await signInWithGoogleEmulator(
  page,
  () => page.getByRole('button', { name: /continuar con google/i }).click(),
  'laura@ejemplo.com',
)

await page.getByLabel('Nombre del hogar').fill('Piso Calle Luna')
await shot(page, '03-crear-paso-1')
await page.getByRole('button', { name: /^siguiente$/i }).click()
await page.getByLabel('Persona 1', { exact: true }).fill('Laura')
await page.getByLabel('Persona 2', { exact: true }).fill('Ben')
await page.getByRole('button', { name: /añadir persona/i }).click()
await page.getByLabel('Persona 3', { exact: true }).fill('Marta')
await shot(page, '04-crear-paso-2')
await page.getByRole('button', { name: /^siguiente$/i }).click()
await page.getByRole('button', { name: /^crear hogar$/i }).waitFor()
await shot(page, '05-crear-paso-3')
await page.getByRole('button', { name: /^crear hogar$/i }).click()

await openTab(page, 'Personas')
await page
  .getByText(/código de invitación/i)
  .first()
  .waitFor()
await shot(page, '06-codigo-invitacion')
const code = ((await page.locator('strong').first().textContent()) ?? '').trim()

// --- Join with the code, from a second phone -------------------------------------------------
const flatmate = await browser.newContext({ ...phone, baseURL })
const second = await flatmate.newPage()
await second.goto('/')
await second.getByRole('button', { name: /unirme a un hogar/i }).click()
await second.getByLabel('Código de invitación').fill(code)
await shot(second, '07-unirse-codigo')
await second.getByRole('button', { name: /continuar/i }).click()
await second.getByRole('button', { name: 'Ben' }).click()
await shot(second, '08-unirse-quien')
await second.getByRole('button', { name: /^unirme$/i }).click()
await second.getByRole('navigation', { name: /secciones/i }).waitFor()
await flatmate.close()
await owner.close()

// --- A home with weeks behind it: Carla in the demo data -------------------------------------
const member = await browser.newContext({ ...phone, baseURL })
const demo = await member.newPage()
await demo.goto('/')
await signInWithGoogleEmulator(
  demo,
  () => demo.getByRole('button', { name: /iniciar sesión con google/i }).click(),
  'carla@demo.com',
)
await demo.getByText('Piso Calle Mayor').first().click()
await demo
  .getByRole('button', { name: /marcar como hecho/i })
  .first()
  .waitFor()
await shot(demo, '09-semana')
await demo
  .getByRole('button', { name: /marcar como hecho/i })
  .first()
  .click()
await shot(demo, '10-marcar-hecho')

await openTab(demo, /^Historial/)
await shot(demo, '11-historial')
await openTab(demo, 'Gastos')
await demo.getByRole('button', { name: /añadir gasto/i }).waitFor()
await shot(demo, '12-gastos')
await demo.getByRole('button', { name: /añadir gasto/i }).click()
await shot(demo, '13-anadir-gasto')
await demo.keyboard.press('Escape')
await openTab(demo, 'Ajustes')
await shot(demo, '14-ajustes')
await member.close()

await browser.close()
stopPreview()
