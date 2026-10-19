import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ArchUnitTS extends Vitest through the global expect
  test: {
    globals: true,
    exclude: ['firestore/**', 'src/**/*.emulator.test.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      // Logic layers only: the Firebase layer is covered by the emulator suite and the UI by component tests
      include: ['src/domain/**', 'src/storage/**', 'src/hooks/**', 'src/firebase/config.ts'],
      // localState.ts is temporary and disappears with the Firestore wiring
      exclude: ['**/*.test.*', 'src/storage/localState.ts'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
})
