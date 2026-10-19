import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { manifest } from './src/pwa/manifest.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The service worker updates itself: installed apps pick up new releases on the next open
      registerType: 'autoUpdate',
      manifest,
      includeAssets: ['favicon.svg', 'logo.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        // Firebase Auth helper pages are served by Hosting and must never be answered from the cache
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  // ArchUnitTS extends Vitest through the global expect
  test: {
    globals: true,
    exclude: ['firestore/**', 'src/**/*.emulator.test.{ts,tsx}', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      // Logic layers only: the Firebase layer is covered by the emulator suite and the UI by component tests
      include: ['src/domain/**', 'src/storage/**', 'src/hooks/**', 'src/firebase/config.ts'],
      exclude: ['**/*.test.*'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
})
