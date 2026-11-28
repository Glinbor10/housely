import { describe, expect, it } from 'vitest'
import { shouldSuggestInstall } from './installHint'

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const android =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'
const desktopMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

const base = { platform: 'iPhone', maxTouchPoints: 5, standalone: false, dismissed: false }

describe('shouldSuggestInstall', () => {
  it('suggests it on an iPhone browsing in Safari', () => {
    expect(shouldSuggestInstall({ ...base, userAgent: iphone })).toBe(true)
  })

  it('suggests it on an iPad that identifies as a Mac', () => {
    expect(
      shouldSuggestInstall({
        ...base,
        userAgent: desktopMac,
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true)
  })

  it('does not suggest it once the app is installed', () => {
    expect(shouldSuggestInstall({ ...base, userAgent: iphone, standalone: true })).toBe(false)
  })

  it('does not suggest it after the person dismissed it', () => {
    expect(shouldSuggestInstall({ ...base, userAgent: iphone, dismissed: true })).toBe(false)
  })

  it('does not suggest it on Android, which installs from the browser prompt', () => {
    expect(
      shouldSuggestInstall({
        ...base,
        userAgent: android,
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBe(false)
  })

  it('does not suggest it on a desktop Mac without a touch screen', () => {
    expect(
      shouldSuggestInstall({
        ...base,
        userAgent: desktopMac,
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false)
  })
})
