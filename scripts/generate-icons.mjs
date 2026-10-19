import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

// Regenerates every app icon from public/logo.svg. Replace the logo, run `npm run icons` and commit.
const LOGO = 'public/logo.svg'
const OUTPUT = 'public/icons'
const BRAND = '#1976d2'

mkdirSync(OUTPUT, { recursive: true })
const svg = readFileSync(LOGO)

const render = (size) => sharp(svg, { density: 384 }).resize(size, size)

await render(192).png().toFile(`${OUTPUT}/icon-192.png`)
await render(512).png().toFile(`${OUTPUT}/icon-512.png`)

// Maskable icons are cropped to a shape by the launcher: keep the logo inside the central safe zone.
const glyph = await render(360).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: BRAND } })
  .composite([{ input: glyph, gravity: 'center' }])
  .png()
  .toFile(`${OUTPUT}/icon-maskable-512.png`)

// iOS rounds the corners itself and does not support transparency: flatten over the brand color.
await render(180).flatten({ background: BRAND }).png().toFile(`${OUTPUT}/apple-touch-icon.png`)

copyFileSync(LOGO, 'public/favicon.svg')
console.log('Icons generated in', OUTPUT)
