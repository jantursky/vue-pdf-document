import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const lib = (path: string) => fileURLToPath(new URL(`../../packages/vue-pdf-document/${path}`, import.meta.url))
const { version } = JSON.parse(readFileSync(lib('package.json'), 'utf8')) as { version: string }

// The dev server reads the library's source so edits hot-reload across packages.
// Builds resolve `vue-pdf-document` through node_modules, i.e. the library's real dist output.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // The layout engine, fontkit and pdfkit are about 1 MB minified; the warning would fire on every build.
  build: { chunkSizeWarningLimit: 1200 },
  define: {
    __VUE_PDF_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: command === 'serve' ? [{ find: /^vue-pdf-document$/, replacement: lib('src/index.ts') }] : [],
  },
}))
