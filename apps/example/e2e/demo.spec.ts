import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { frameSrc, readPdf, waitForDownload, watchErrors } from './helpers'

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page)
  await page.goto('/')
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test('renders every example to a PDF', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF files from Vue components')
  for (const id of ['#example-minimal', '#example-invoice', '#example-report']) {
    const pdf = await readPdf(page, await frameSrc(page.locator(id)))
    expect(pdf.header).toBe('%PDF-')
    expect(pdf.pages).toBeGreaterThan(0)
  }
})

test('renders again when the data changes', async ({ page }) => {
  const example = page.locator('#example-minimal')
  const before = await frameSrc(example)
  await example.getByLabel('Name').fill('Grace')
  await expect(example.locator('[data-pdf-viewer-frame]')).not.toHaveAttribute('src', before)
  expect((await readPdf(page, await frameSrc(example))).header).toBe('%PDF-')
})

test('downloads the invoice under its number', async ({ page }) => {
  const example = page.locator('#example-invoice')
  await example.getByLabel('Number').fill('2026-099')
  await example.getByLabel('New item').fill('Hosting')
  await example.getByRole('button', { name: 'Add' }).click()
  await expect(example.locator('.items li')).toHaveCount(3)

  const link = example.locator('[data-pdf-download-link]')
  await expect(link).toHaveAttribute('download', 'invoice-2026-099.pdf')
  await expect(link).toHaveAttribute('href', /^blob:/)
  await expect(link).toHaveText(/Download PDF/)

  const [download] = await Promise.all([waitForDownload(page, 'invoice-2026-099.pdf'), link.click()])
  const bytes = await readFile(await download.path())
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('paginates the report as sections are added', async ({ page }) => {
  const example = page.locator('#example-report')
  const before = await frameSrc(example)
  const { pages: few } = await readPdf(page, before)

  await example.getByRole('slider').fill('60')
  await expect(example.locator('[data-pdf-viewer-frame]')).not.toHaveAttribute('src', before)
  const { pages: many } = await readPdf(page, await frameSrc(example))
  expect(many).toBeGreaterThan(few)
})

test('shows the source of an example', async ({ page }) => {
  const example = page.locator('#example-invoice')
  await example.getByRole('button', { name: 'View source' }).click()
  await expect(example.getByRole('tab', { name: 'InvoiceDocument.vue' })).toHaveAttribute('aria-selected', 'true')
  await expect(example.getByRole('tabpanel')).toContainText('<Document')
})

test('headless demo exposes the composable state', async ({ page }) => {
  const demo = page.locator('#demo-headless')
  await expect(demo.locator('[data-state="loading"]')).toHaveText('false')
  await expect(demo.locator('[data-state="size"]')).toHaveText(/kB$/)
  await expect(demo.locator('object')).toHaveAttribute('data', /^blob:/)
})

test('renders on demand and downloads the file', async ({ page }) => {
  const demo = page.locator('#demo-on-demand')
  const [download] = await Promise.all([
    waitForDownload(page, 'report.pdf'),
    demo.getByRole('button', { name: 'Download a 20-section report' }).click(),
  ])
  const bytes = await readFile(await download.path())
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  await expect(demo.locator('[data-result]')).toHaveText(/^report\.pdf, .* kB in \d+ ms$/)
})
