import { defineConfig } from 'vitest/config'

// Rules tests need the Firestore emulator: run them with `npm run test:rules`.
export default defineConfig({
  test: {
    include: ['firestore/**/*.test.ts', 'src/**/*.emulator.test.{ts,tsx}'],
    fileParallelism: false,
    testTimeout: 15000,
  },
})
