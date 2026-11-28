import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

// The launcher icons of the Android app, from the same drawings as the web icons:
//   public/logo.svg    -> android/app/src/main/res/mipmap-*/ic_launcher.png  (Android 7 and older)
//   public/mascot.svg  -> android/app/src/main/res/mipmap-*/ic_launcher_foreground.png  (adaptive icon)
// Run `npm run icons` first if the mascot changed, then `npm run icons:android`, and commit.
const RES = 'android/app/src/main/res'
// Pixels per dp on each screen density (mdpi is 1)
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
// The launcher icon is 48dp; each layer of an adaptive icon is 108dp and only its central 66dp always shows
const LEGACY_DP = 48
const LAYER_DP = 108
const SAFE_DP = 66

const logo = readFileSync('public/logo.svg')
const mascot = readFileSync('public/mascot.svg')

for (const [density, scale] of Object.entries(DENSITIES)) {
  const folder = `${RES}/mipmap-${density}`
  mkdirSync(folder, { recursive: true })

  const legacy = Math.round(LEGACY_DP * scale)
  await sharp(logo, { density: 384 })
    .resize(legacy, legacy)
    .png()
    .toFile(`${folder}/ic_launcher.png`)

  // The house sits inside the safe zone, on a transparent layer: the background is a color of the app
  const layer = Math.round(LAYER_DP * scale)
  const house = Math.round(SAFE_DP * scale)
  await sharp({
    create: {
      width: layer,
      height: layer,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(mascot, { density: 384 }).resize(house, house).png().toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(`${folder}/ic_launcher_foreground.png`)
}

console.log('Android icons generated in', RES)
