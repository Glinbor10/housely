import { createTheme, type ThemeOptions } from '@mui/material'

// Apple and Google recommend targets of at least 44px for comfortable use with a finger.
export const MIN_TOUCH_TARGET = 44

// The floating bar of the sections (see BottomTabs): its height, and its distance from the bottom of the screen
export const TAB_BAR_HEIGHT = 68
export const TAB_BAR_OFFSET = 12

// The sizes of the round marks (dots, badges, avatars) that repeat across the screens, in px
export const SIZE = {
  dot: 14,
  mark: 18,
  badge: 22,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 48,
  hero: 56,
} as const

// Expressive look: blue like the mascot (navy house, sky blue roof), big rounded shapes and a friendly
// typeface served from our own origin (see main.tsx).
export const themeOptions: ThemeOptions = {
  // Light and dark follow the setting of the device
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#2c5db8' },
        secondary: { main: '#5aa2f0' },
        // Deep enough for white text on it (5.4:1) and for it as text on the page (5:1)
        success: { main: '#167a46' },
        // White on this orange only reaches 3:1; black reaches 6.8:1, which the chips of missed zones need
        warning: { main: '#ed6c02', contrastText: '#000000' },
        background: { default: '#f3f7ff', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#8fb5ff' },
        secondary: { main: '#7cc0ff' },
        success: { main: '#4fd99a' },
        background: { default: '#0d1524', paper: '#162036' },
      },
    },
  },
  shape: { borderRadius: 20 },
  typography: {
    fontFamily: '"Nunito Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h3: { fontWeight: 800 },
    h4: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
    h5: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
    h6: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
    button: { fontWeight: 800 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // The bar floats over the page: what is scrolled to or focused must stop above it, not behind it
        html: {
          scrollPaddingBottom: `calc(${TAB_BAR_HEIGHT}px + max(${TAB_BAR_OFFSET}px, env(safe-area-inset-bottom, 0px)) + 16px)`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: MIN_TOUCH_TARGET, borderRadius: 999, textTransform: 'none' },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: MIN_TOUCH_TARGET,
          minWidth: MIN_TOUCH_TARGET,
          textTransform: 'none',
          // The default grey of an unselected button does not reach the 4.5:1 contrast of WCAG AA
          color: 'inherit',
        },
      },
    },
    MuiCard: { styleOverrides: { root: { borderRadius: 28 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 20 } } },
    MuiRadio: { styleOverrides: { root: { padding: 12 } } },
  },
}

export const theme = createTheme(themeOptions)
