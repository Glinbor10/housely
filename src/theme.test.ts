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

  it('applies the touch target to toggle buttons, like the language switch', () => {
    const root = theme.components?.MuiToggleButton?.styleOverrides?.root as {
      minHeight?: number
      minWidth?: number
    }
    expect(root.minHeight).toBe(MIN_TOUCH_TARGET)
    expect(root.minWidth).toBe(MIN_TOUCH_TARGET)
  })

  it('follows the dark mode of the device', () => {
    expect(themeOptions.colorSchemes?.dark).toBeTruthy()
    expect(themeOptions.colorSchemes?.light).toBeTruthy()
  })

  it('has its own palette in both modes, not the default blue', () => {
    const light = themeOptions.colorSchemes?.light
    const dark = themeOptions.colorSchemes?.dark
    expect(typeof light === 'object' && light.palette?.primary).toEqual({ main: '#5b5bd6' })
    expect(typeof dark === 'object' && dark.palette?.primary).toBeTruthy()
  })

  it('uses rounded shapes and a self-hosted typeface', () => {
    expect(theme.shape.borderRadius).toBeGreaterThanOrEqual(16)
    expect(theme.typography.fontFamily).toContain('Nunito Variable')
    // Never a remote font: the Content-Security-Policy only allows our own
    expect(theme.typography.fontFamily).not.toMatch(/googleapis|http/)
  })

  it('makes the primary action stand out with a pill shape', () => {
    const root = theme.components?.MuiButton?.styleOverrides?.root as {
      borderRadius?: number | string
      textTransform?: string
    }
    expect(root.borderRadius).toBe(999)
    expect(root.textTransform).toBe('none')
  })
})
