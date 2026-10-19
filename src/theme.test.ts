import { describe, expect, it } from 'vitest'
import { MIN_TOUCH_TARGET, theme, themeOptions } from './theme'

describe('theme', () => {
  it('keeps touch targets at least 44px, the minimum for comfortable use on phones', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44)
  })

  it('applies the touch target to buttons', () => {
    const root = theme.components?.MuiButton?.styleOverrides?.root as { minHeight?: number }
    expect(root.minHeight).toBe(MIN_TOUCH_TARGET)
  })

  it('follows the dark mode of the device', () => {
    expect(themeOptions.colorSchemes?.dark).toBeTruthy()
    expect(themeOptions.colorSchemes?.light).toBeTruthy()
  })
})
