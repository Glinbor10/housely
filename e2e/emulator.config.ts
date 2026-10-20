import { defineConfig, devices } from '@playwright/test'

// Full flows against the Firebase emulators, serving the production build with `vite preview` so the
// service worker is real. The Auth emulator simulates Google sign-in with a popup, driven for real.
// The Content-Security-Policy is not applied here (it would block the local emulators on purpose):
// it is verified against the deployed environments by deployed/mobile.spec.ts.
// Usage: `npm run e2e:emulator`, which starts the emulators and then runs this configuration.
const PORT = 4173

export default defineConfig({
  testDir: './emulator',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // Two emulators and real popups per test: a couple of workers is stable, more only adds noise
  retries: 2,
  fullyParallel: true,
  workers: 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // The app follows the language of the device: tests run in English wherever they are launched
    locale: 'en-US',
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite build --mode emulators && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // The command runs from the folder of this file by default; the build lives at the repository root
    cwd: '..',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
})
