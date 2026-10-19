import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Width and height live in the IHDR chunk of a PNG, right after the 8 byte signature.
const pngSize = (path) => {
  const bytes = readFileSync(path)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('app icons (generated from public/logo.svg with `npm run icons`)', () => {
  it('has the logo that the owner can replace', () => {
    expect(existsSync('public/logo.svg')).toBe(true)
    expect(readFileSync('public/logo.svg', 'utf8')).toContain('<svg')
  })

  it.each([
    ['public/icons/icon-192.png', 192],
    ['public/icons/icon-512.png', 512],
    ['public/icons/icon-maskable-512.png', 512],
    ['public/icons/apple-touch-icon.png', 180],
  ])('%s is a %ipx square PNG', (path, size) => {
    expect(existsSync(path)).toBe(true)
    expect(pngSize(path)).toEqual({ width: size, height: size })
  })
})
