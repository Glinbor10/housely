import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync('index.html', 'utf8')

const metaContent = (attribute, name) => {
  const tag = html.match(new RegExp(`<meta[^>]*${attribute}="${name}"[^>]*>`, 's'))?.[0] ?? ''
  return tag.match(/content="([^"]*)"/s)?.[1]
}

// Width and height live in the IHDR chunk of a PNG, right after the 8 byte signature.
const pngSize = (path) => {
  const bytes = readFileSync(path)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('link preview (what WhatsApp, iMessage or Slack show when the link is shared)', () => {
  it('has an Open Graph title, description and type', () => {
    expect(metaContent('property', 'og:title')).toBeTruthy()
    expect((metaContent('property', 'og:description') ?? '').length).toBeGreaterThan(20)
    expect(metaContent('property', 'og:type')).toBe('website')
    expect(metaContent('property', 'og:site_name')).toBe('Housely')
  })

  it('points to an absolute https image, because crawlers do not resolve relative paths', () => {
    expect(metaContent('property', 'og:image')).toMatch(/^https:\/\/.+\/og-image\.png$/)
    expect(metaContent('property', 'og:image:width')).toBe('1200')
    expect(metaContent('property', 'og:image:height')).toBe('630')
    expect((metaContent('property', 'og:image:alt') ?? '').length).toBeGreaterThan(10)
  })

  it('asks for a large image card on Twitter and others that read twitter tags', () => {
    expect(metaContent('name', 'twitter:card')).toBe('summary_large_image')
    expect(metaContent('name', 'twitter:image')).toMatch(/^https:\/\/.+\/og-image\.png$/)
  })

  it('ships the 1200x630 image that the tags point to', () => {
    expect(existsSync('public/og-image.svg')).toBe(true)
    expect(existsSync('public/og-image.png')).toBe(true)
    expect(pngSize('public/og-image.png')).toEqual({ width: 1200, height: 630 })
  })
})
