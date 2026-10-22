import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// The unit suite runs in happy-dom under Node, where pdfkit loads its Node build.
// These tests load the browser build in real engines, the way an app bundles it.
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['test/browser/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
})
