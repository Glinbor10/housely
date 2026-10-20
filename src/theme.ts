import { createTheme, type ThemeOptions } from '@mui/material'

// Apple and Google recommend targets of at least 44px for comfortable use with a finger.
export const MIN_TOUCH_TARGET = 44

export const themeOptions: ThemeOptions = {
  // Light and dark follow the setting of the device
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: '#1976d2' } },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: MIN_TOUCH_TARGET } } },
    MuiToggleButton: {
      styleOverrides: { root: { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET } },
    },
    MuiRadio: { styleOverrides: { root: { padding: 12 } } },
  },
}

export const theme = createTheme(themeOptions)
