import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// Regenerates every app icon and the link preview card from the mascot:
//   public/mascot.svg  ->  public/logo.svg, public/favicon.svg, public/icons/*.png, public/og-image.*
// Change the drawing in public/mascot.svg, run `npm run icons` and commit.
const MASCOT = 'public/mascot.svg'
const OUTPUT = 'public/icons'
// The icon is light so the navy house stands out from its background, whatever the home screen is like
const LIGHT_TOP = '#ffffff'
const LIGHT_BOTTOM = '#cfe0fb'

mkdirSync(OUTPUT, { recursive: true })
const mascot = readFileSync(MASCOT, 'utf8')
// What is inside <svg>...</svg>, to place the same drawing in other files
const inner = mascot.slice(
  mascot.indexOf('>', mascot.indexOf('<svg')) + 1,
  mascot.lastIndexOf('</svg>'),
)

const gradient = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${LIGHT_TOP}"/><stop offset="1" stop-color="${LIGHT_BOTTOM}"/></linearGradient>`

// The app icon: a light rounded tile with the house centered in it
const tile = `<defs>${gradient('tile')}</defs><rect width="512" height="512" rx="112" fill="url(#tile)"/><g transform="translate(36 12) scale(2.2)">${inner}</g>`
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Housely">${tile}</svg>`
writeFileSync('public/logo.svg', logo)
writeFileSync('public/favicon.svg', logo)

const render = (size) => sharp(Buffer.from(logo), { density: 384 }).resize(size, size)
await render(192).png().toFile(`${OUTPUT}/icon-192.png`)
await render(512).png().toFile(`${OUTPUT}/icon-512.png`)

// Maskable icons and the iOS one are cropped or rounded by the system: full-bleed light background
// and the house inside the central safe zone.
const fullBleed = async (size, glyphSize) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs>${gradient('bg')}</defs><rect width="${size}" height="${size}" fill="url(#bg)"/></svg>`,
    ),
  ).composite([
    {
      input: await sharp(Buffer.from(mascot), { density: 384 })
        .resize(glyphSize, glyphSize)
        .png()
        .toBuffer(),
      gravity: 'center',
    },
  ])
await (await fullBleed(512, 330)).png().toFile(`${OUTPUT}/icon-maskable-512.png`)
await (await fullBleed(180, 124)).png().toFile(`${OUTPUT}/apple-touch-icon.png`)

// Link preview card (WhatsApp, iMessage, Slack...): 1200x630 is the size every platform expects
const card = readFileSync('scripts/og-image.template.svg', 'utf8').replace('{{LOGO}}', tile)
writeFileSync('public/og-image.svg', card)
await sharp(Buffer.from(card), { density: 96 })
  .resize(1200, 630)
  .png()
  .toFile('public/og-image.png')

console.log('Icons generated in', OUTPUT)
