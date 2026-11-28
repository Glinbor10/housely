import './fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { LazyMotion, MotionConfig } from 'motion/react'
import App from './App.tsx'
import { initLocale } from './i18n/i18n'
import { getBrowserStorage } from './storage/session'
import { theme } from './theme'

// The language is known before the first render, so the page never flashes in the wrong one
initLocale(getBrowserStorage())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* "user": people who asked for less motion get no movement, only fades */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={() => import('./motionFeatures').then((module) => module.default)}>
          <App />
        </LazyMotion>
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>,
)
