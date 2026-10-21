import { createTheme, type ThemeOptions } from '@mui/material'

// Apple and Google recommend targets of at least 44px for comfortable use with a finger.
export const MIN_TOUCH_TARGET = 44

// Expressive look: a vivid indigo with a warm coral accent, big rounded shapes and a friendly
// typeface served from our own origin (see main.tsx).
export const themeOptions: ThemeOptions = {
  // Light and dark follow the setting of the device
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#5b5bd6' },
        secondary: { main: '#ff8a5b' },
        success: { main: '#1f9d63' },
        background: { default: '#f6f5ff', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#a5a5ff' },
        secondary: { main: '#ff9d78' },
        success: { main: '#4fd99a' },
        background: { default: '#14141f', paper: '#1d1d2b' },
      },
    },
  },
  shape: { borderRadius: 20 },
  typography: {
    fontFamily: '"Nunito Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h3: { fontWeight: 800 },
    h4: { fontWeight: 800 },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 800 },
  },
  components: {
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
