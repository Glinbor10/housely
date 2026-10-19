import { describe, expect, it } from 'vitest'
import { manifest } from './manifest'

describe('web app manifest', () => {
  it('is installable as a standalone app that opens on the flat', () => {
    expect(manifest.name).toBe('Housely')
    expect(manifest.short_name).toBe('Housely')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('portrait')
  })

  it('has a description and colors for the splash screen and the system bars', () => {
    expect((manifest.description ?? '').length).toBeGreaterThan(10)
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('ships the icon sizes Android and Chrome require, with a maskable one', () => {
    const icons = manifest.icons ?? []
    const bySize = (size: string, purpose?: string) =>
      icons.find((icon) => icon.sizes === size && icon.purpose === purpose)
    expect(bySize('192x192', 'any')).toBeTruthy()
    expect(bySize('512x512', 'any')).toBeTruthy()
    expect(bySize('512x512', 'maskable')).toBeTruthy()
    icons.forEach((icon) => expect(icon.type).toBe('image/png'))
  })
})
