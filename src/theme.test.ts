import { describe, expect, it } from 'vitest'
import { contrastRatio } from './domain/color'
import { MIN_TOUCH_TARGET, TAB_BAR_HEIGHT, theme, themeOptions } from './theme'

describe('theme', () => {
  it('keeps touch targets at least 44px, the minimum for comfortable use on phones', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44)
  })

  it('keeps what is scrolled to or focused clear of the floating tab bar, so it is never hidden behind it', () => {
    // WCAG 2.2 (2.4.11, focus not obscured): the bar floats over the page, so the page reserves its room
    const styles = theme.components?.MuiCssBaseline?.styleOverrides as {
      html?: { scrollPaddingBottom?: string }
    }
    expect(styles.html?.scrollPaddingBottom).toContain(`${TAB_BAR_HEIGHT}px`)
    expect(styles.html?.scrollPaddingBottom).toContain('safe-area-inset-bottom')
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
    expect(typeof light === 'object' && light.palette?.primary).toEqual({ main: '#2c5db8' })
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

  it('has readable text on the warning color, which the chips of the missed zones use', () => {
    const light = themeOptions.colorSchemes?.light
    const warning = typeof light === 'object' ? light.palette?.warning : undefined
    expect(warning && 'main' in warning && 'contrastText' in warning).toBe(true)
    if (warning && 'main' in warning && 'contrastText' in warning) {
      expect(
        contrastRatio(String(warning.main), String(warning.contrastText)),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('is blue, like the mascot: no purple or indigo in the colors of the interface', () => {
    const hueOf = (hex: string): number => {
      const [red, green, blue] = [1, 3, 5].map(
        (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
      )
      const max = Math.max(red, green, blue)
      const min = Math.min(red, green, blue)
      const delta = max - min
      if (delta === 0) return 0
      const hue =
        max === red
          ? ((green - blue) / delta) % 6
          : max === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4
      return (hue * 60 + 360) % 360
    }
    for (const mode of ['light', 'dark'] as const) {
      const scheme = themeOptions.colorSchemes?.[mode]
      const palette = typeof scheme === 'object' ? scheme.palette : undefined
      for (const color of [palette?.primary, palette?.secondary]) {
        const main = color && 'main' in color ? String(color.main) : ''
        // Blue is between cyan and just before violet; purple and indigo start around 250
        expect(hueOf(main), `${mode} ${main}`).toBeGreaterThan(190)
        expect(hueOf(main), `${mode} ${main}`).toBeLessThan(230)
      }
    }
  })

  it('has readable text on the primary color in light and dark mode', () => {
    const light = themeOptions.colorSchemes?.light
    const dark = themeOptions.colorSchemes?.dark
    const lightMain =
      typeof light === 'object' && light.palette?.primary && 'main' in light.palette.primary
        ? String(light.palette.primary.main)
        : ''
    const darkMain =
      typeof dark === 'object' && dark.palette?.primary && 'main' in dark.palette.primary
        ? String(dark.palette.primary.main)
        : ''
    // Buttons use white text on the light primary, and the text itself is the primary on dark paper
    expect(contrastRatio(lightMain, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(darkMain, '#162036')).toBeGreaterThanOrEqual(4.5)
  })
})
