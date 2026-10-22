import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const root = (path: string): string => resolve(import.meta.dirname, path)

const pkg = JSON.parse(readFileSync(root('package.json'), 'utf8')) as { dependencies: Record<string, string> }
// Size budgets live in .size-limit.json and run after every build (`bun run size`).
const external = ['vue', ...Object.keys(pkg.dependencies)]

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      include: ['src'],
      bundleTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: root('src/index.ts'),
      // ESM only: the @react-pdf packages and pdfkit's browser build ship no CommonJS.
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // Subpaths too, such as `@react-pdf/fns` internals or `vue/...`.
      external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
    },
    sourcemap: true,
    minify: true,
    target: 'es2020',
    emptyOutDir: true,
  },
})
