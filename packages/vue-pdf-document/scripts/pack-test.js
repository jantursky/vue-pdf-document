// Installs the packed tarball into an empty project, the way a consumer gets it from
// npm, and renders a document from it in plain Node. Run after `bun run build`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageDir = resolve(import.meta.dirname, '..')
const dir = mkdtempSync(join(tmpdir(), 'vue-pdf-document-pack-'))
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' })

try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', dir], packageDir))
  const files = packed.files.map((file) => file.path).sort()
  const allowed = /^(dist\/index\.(js|js\.map|d\.ts)|README\.md|CHANGELOG\.md|LICENSE|package\.json)$/
  const unexpected = files.filter((file) => !allowed.test(file))
  if (unexpected.length > 0) throw new Error(`Unexpected files in the tarball: ${unexpected.join(', ')}`)
  console.log(`tarball: ${packed.filename}, ${files.length} files, ${(packed.size / 1024).toFixed(1)} kB`)

  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }))
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', `./${packed.filename}`, 'vue@^3.5.0'], dir)

  writeFileSync(
    join(dir, 'consumer.js'),
    `import { h } from 'vue'
import { Document, Page, Text, renderToBuffer } from 'vue-pdf-document'

const Hello = { render: () => h(Document, { title: 'Pack test' }, () => h(Page, () => h(Text, () => 'Hello'))) }
const bytes = await renderToBuffer(Hello)
const header = new TextDecoder().decode(bytes.subarray(0, 5))
if (header !== '%PDF-') throw new Error('Not a PDF: ' + header)
console.log('rendered ' + bytes.length + ' bytes from the installed package')
`,
  )
  console.log(run('node', ['consumer.js'], dir).trim())

  // CommonJS consumers load the ESM build through Node's require(esm).
  writeFileSync(
    join(dir, 'consumer.cjs'),
    `const { renderToBuffer, Document } = require('vue-pdf-document')
if (typeof renderToBuffer !== 'function' || !Document) throw new Error('require() returned no exports')
console.log('require() works')
`,
  )
  console.log(run('node', ['consumer.cjs'], dir).trim())
} finally {
  rmSync(dir, { recursive: true, force: true })
}
