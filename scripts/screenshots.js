// Builds the demo, serves the build and captures the README screenshots into .github/assets:
// each view at 1280×800 (device scale 2) in light and dark, plus one page of the generated invoice.
// Re-run it with `bun run screenshots` whenever the demo's look changes.

/* global document, scrollY, window -- used inside page.evaluate callbacks, which run in the browser */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, relative } from 'node:path'

import { chromium } from 'playwright'
import sharp from 'sharp'

const root = join(import.meta.dirname, '..')
const dist = join(root, 'apps/example/dist')
const out = join(root, '.github/assets')
const viewport = { width: 1280, height: 800 }

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

/** Serves the built demo on a free port; unknown paths fall back to index.html. */
const serve = () =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      let file = join(dist, path)
      if (!file.startsWith(dist) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
        file = join(dist, 'index.html')
      }
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
      response.end(readFileSync(file))
    })
    server.listen(0, () => resolve(server))
  })

/** Scrolls so the element sits just below the sticky header and tab bar. */
const scrollTo = (page, selector) =>
  page.locator(selector).evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 140))

/** Waits until every PDF frame on the page shows a rendered blob and Chrome's viewer has drawn it. */
const settle = async (page, frames) => {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  for (const frame of await page.locator(frames).all()) {
    await frame.waitFor()
    const handle = await frame.elementHandle()
    await page.waitForFunction((element) => element.src.startsWith('blob:'), handle)
    // Hide the viewer's thumbnail rail and fit the page to the width, so the document reads at a glance.
    // A hash change alone doesn't reload the viewer, so the frame goes through about:blank.
    await handle.evaluate(async (element) => {
      const src = element.src.split('#')[0]
      element.src = 'about:blank'
      await new Promise((resolve) => element.addEventListener('load', resolve, { once: true }))
      element.src = `${src}#navpanes=0&view=FitH`
    })
  }
  // The built-in PDF viewer draws a moment after the frame loads, and has no event for it.
  await page.waitForTimeout(2000)
}

/**
 * Waits for the generator's sample invoice with its payment QR code, and returns its blob URL.
 * The code is drawn asynchronously, so the first finished render comes without it.
 * (`waitForFunction` doesn't await an async predicate, hence the loop.)
 */
const invoiceReady = async (page) => {
  for (const deadline = Date.now() + 20_000; Date.now() < deadline; await page.waitForTimeout(250)) {
    const src = await page.evaluate(async () => {
      const url = document.querySelector('[data-invoice-frame]')?.getAttribute('src')
      return url && (await (await fetch(url)).text()).includes('/Subtype /Image') ? url : null
    })
    if (src) return src
  }
  throw new Error('The sample invoice never rendered with its QR code')
}

const views = [
  {
    name: 'overview',
    path: '/',
    prepare: (page) => settle(page, '[data-pdf-viewer-frame]'),
  },
  {
    name: 'generator',
    path: '/#generator',
    prepare: async (page) => {
      await invoiceReady(page)
      await scrollTo(page, '.gen-form')
      await settle(page, '[data-invoice-frame]')
    },
  },
  {
    name: 'examples',
    path: '/',
    prepare: async (page) => {
      await scrollTo(page, '#example-invoice')
      await settle(page, '[data-pdf-viewer-frame]')
    },
  },
]

/** Writes a palette-quantised PNG, which keeps flat UI screenshots well under 300 KB. */
const save = async (buffer, name) => {
  const file = join(out, `${name}.png`)
  await sharp(buffer).png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 }).toFile(file)
  console.log(`wrote ${relative(root, file)} (${Math.round(statSync(file).size / 1024)} KB)`)
}

execSync('bun run build', { cwd: root, stdio: 'inherit' })
mkdirSync(out, { recursive: true })
const server = await serve()
const base = `http://localhost:${server.address().port}`
// Full Chromium rather than the headless shell, which has no PDF viewer for the previews.
const browser = await chromium.launch({ channel: 'chromium' })

try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme })
    for (const view of views) {
      const page = await context.newPage()
      await page.goto(base + view.path)
      await view.prepare(page)
      await save(await page.screenshot(), `${view.name}-${colorScheme}`)
      await page.close()
    }
    await context.close()
  }

  // The generated invoice itself: the sample's PDF opened on its own, fitted to an A4-shaped window.
  const context = await browser.newContext({ viewport: { width: 640, height: 905 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto(`${base}/#generator`)
  const src = await invoiceReady(page)
  await page.setContent(
    `<style>body{margin:0}</style><iframe src="${src}#toolbar=0&navpanes=0&view=FitH" style="border:0;width:100vw;height:100vh"></iframe>`,
  )
  await page.waitForTimeout(2000)
  // Trim the viewer's dark backdrop around the page.
  await save(
    await sharp(await page.screenshot())
      .trim({ threshold: 40 })
      .toBuffer(),
    'invoice-pdf',
  )
  await context.close()
} finally {
  await browser.close()
  server.close()
}
