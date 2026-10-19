import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ArchUnitTS extends Vitest through the global expect
  test: {
    globals: true,
    exclude: ['firestore/**', 'src/**/*.emulator.test.ts', 'node_modules/**'],
  },
})
