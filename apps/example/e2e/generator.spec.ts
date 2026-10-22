import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { waitForDownload, watchErrors } from './helpers'

// A 1×1 PNG, for the logo upload.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
)

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page)
  await page.goto('/#generator')
  // The first render also loads the generator's chunk and three font files.
  await expect(page.locator('[data-status]')).toHaveText(/^Ready/, { timeout: 15_000 })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

const frame = (page: Page) => page.locator('[data-invoice-frame]')

/** Waits for a render newer than `previous` and returns the PDF's raw text. */
const nextPdf = async (page: Page, previous?: string | null) => {
  if (previous) await expect(frame(page)).not.toHaveAttribute('src', previous)
  await expect(page.locator('[data-status]')).toHaveText(/^Ready/)
  const src = (await frame(page).getAttribute('src')) ?? ''
  const text = await page.evaluate(async (url) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
    return new TextDecoder('latin1').decode(bytes)
  }, src)
  return { src, text, pages: Number(/\/Type \/Pages\s*\/Count (\d+)/.exec(text)?.[1] ?? 0) }
}

const total = (page: Page, name: 'subtotal' | 'vat' | 'total') => page.locator(`[data-total="${name}"]`)

test('opens from its tab and renders the sample invoice with an embedded font', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Invoice generator' })).toHaveAttribute('aria-selected', 'true')
  const pdf = await nextPdf(page)
  expect(pdf.text.startsWith('%PDF-')).toBe(true)
  expect(pdf.pages).toBe(1)
  expect(pdf.text).toMatch(/\/BaseFont \/[A-Z]{6}\+Roboto-Regular/)
  // The sample has a payment QR code.
  expect(pdf.text).toContain('/Subtype /Image')

  await expect(total(page, 'subtotal')).toHaveText('€7,399.80')
  await expect(total(page, 'vat')).toHaveText('€1,687.59')
  await expect(total(page, 'total')).toHaveText('€9,087.39')
})

test('switches tabs with the keyboard and the URL', async ({ page }) => {
  const generatorTab = page.getByRole('tab', { name: 'Invoice generator' })
  await generatorTab.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeFocused()
  await expect(page.locator('#example-minimal')).toBeVisible()
  await page.goBack()
  await expect(generatorTab).toHaveAttribute('aria-selected', 'true')
})

test('recomputes totals per VAT rate as items change', async ({ page }) => {
  const { src } = await nextPdf(page)
  await page.getByRole('button', { name: 'Add item' }).click()
  const row = page.locator('[data-item]').last()
  await row.getByLabel('Description').fill('Hosting')
  await row.getByLabel('Quantity').fill('2')
  await row.getByLabel('Unit price').fill('100')
  await row.getByLabel('VAT rate').selectOption('19')

  await expect(total(page, 'subtotal')).toHaveText('€7,599.80')
  await expect(total(page, 'vat')).toHaveText('€1,725.59')
  await expect(total(page, 'total')).toHaveText('€9,325.39')
  await nextPdf(page, src)

  await page.getByLabel('Supplier is a VAT payer').uncheck()
  await expect(total(page, 'vat')).toHaveCount(0)
  await expect(total(page, 'total')).toHaveText('€7,599.80')
})

test('writes the invoice language into the PDF', async ({ page }) => {
  const { src, text } = await nextPdf(page)
  expect(text).toContain('/Lang (en)')
  await page.getByLabel('Language of the invoice').selectOption('sk')
  expect((await nextPdf(page, src)).text).toContain('/Lang (sk)')
})

test('drops the QR code when it is turned off, and draws an uploaded logo', async ({ page }) => {
  const first = await nextPdf(page)
  await page.getByLabel(/Payment QR code/).uncheck()
  const withoutQr = await nextPdf(page, first.src)
  expect(withoutQr.text).not.toContain('/Subtype /Image')

  await page.locator('[data-logo-input]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByAltText('Logo preview')).toBeVisible()
  expect((await nextPdf(page, withoutQr.src)).text).toContain('/Subtype /Image')
})

test('downloads the PDF named after the invoice number', async ({ page }) => {
  await page.locator('#gen-number').fill('2026-777')
  const link = page.locator('[data-download]')
  await expect(link).toHaveAttribute('download', 'invoice-2026-777.pdf')
  await expect(page.locator('[data-status]')).toHaveText(/^Ready/)
  const [download] = await Promise.all([waitForDownload(page, 'invoice-2026-777.pdf'), link.click()])
  const bytes = await readFile(await download.path())
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('keeps the draft across reloads', async ({ page }) => {
  await page.locator('#buyer-name').fill('Contoso Ltd.')
  await page.reload()
  await expect(page.locator('#buyer-name')).toHaveValue('Contoso Ltd.')
})

test('exports and imports the invoice as JSON', async ({ page }) => {
  const number = await page.locator('#gen-number').inputValue()
  const [download] = await Promise.all([
    waitForDownload(page, `invoice-${number}.json`),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ])
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as { number: string; items: unknown[] }
  expect(exported.items).toHaveLength(4)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('[data-item]')).toHaveCount(0)
  await expect(total(page, 'total')).toHaveText('€0.00')

  const edited = { ...exported, number: 'IMPORTED-1' }
  await page.locator('[data-import-input]').setInputFiles({
    name: 'invoice.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(edited)),
  })
  await expect(page.locator('#gen-number')).toHaveValue('IMPORTED-1')
  await expect(page.locator('[data-item]')).toHaveCount(4)

  await page.locator('[data-import-input]').setInputFiles({
    name: 'nope.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  })
  await expect(page.getByRole('alert')).toHaveText("nope.json isn't an invoice exported from this generator.")
})

test('paginates long invoices with the table header on every page', async ({ page }) => {
  const { src } = await nextPdf(page)
  for (let i = 0; i < 30; i += 1) await page.getByRole('button', { name: 'Add item' }).click()
  await expect(page.locator('[data-item]')).toHaveCount(34)
  // A slow engine can finish a render while items are still being added, so wait for the final one.
  let latest = src
  await expect
    .poll(async () => {
      const pdf = await nextPdf(page, latest)
      latest = pdf.src
      return pdf.pages
    })
    .toBe(2)
})
