// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buzz, celebrate, prefersReducedMotion } from './celebrate'

const mockMotion = (reduced: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }) as MediaQueryList)

afterEach(() => vi.unstubAllGlobals())

describe('prefersReducedMotion', () => {
  it('follows the setting of the device', () => {
    mockMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    mockMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('buzz', () => {
  it('vibrates briefly where the device supports it', () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    buzz()
    expect(vibrate).toHaveBeenCalledWith(15)
  })

  it('does nothing where it is not supported (iOS Safari)', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })
    expect(() => buzz()).not.toThrow()
  })
})

describe('celebrate', () => {
  it('throws no confetti for people who asked for less motion', async () => {
    mockMotion(true)
    const launch = vi.fn()
    await celebrate(launch)
    expect(launch).not.toHaveBeenCalled()
  })

  it('throws confetti otherwise', async () => {
    mockMotion(false)
    const launch = vi.fn()
    await celebrate(launch)
    expect(launch).toHaveBeenCalled()
  })
})
