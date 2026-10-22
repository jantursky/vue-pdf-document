import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    // Real-browser tests have their own config: vitest.browser.config.ts.
    exclude: ['test/browser/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/index.ts', 'src/shims.d.ts', 'src/components/types.ts'],
      // lcov is what CI uploads to Codecov.
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 95 },
    },
  },
})
