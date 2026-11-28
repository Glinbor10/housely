import { defineConfig, devices } from '@playwright/test'

// Read-only tests against a deployed environment: they exercise the real build, the headers, the
// service worker and Firebase without writing data (creating a flat needs a real Google account,
// so those flows run against the emulators, see emulator.config.ts). Usage:
//   E2E_BASE_URL=https://housely-ci.web.app npm run e2e
const baseURL = process.env.E2E_BASE_URL
if (!baseURL) {
  throw new Error('Set E2E_BASE_URL to the URL of a deployed Housely environment')
}

export default defineConfig({
  testDir: './deployed',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, locale: 'en-US', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    // The iPhone profile runs WebKit, the engine of Safari and of every browser on iOS
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
})
