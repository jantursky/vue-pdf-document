import { expect, type Download, type Locator, type Page } from '@playwright/test'

/** The blob URL a viewer's frame currently shows, once it has one. */
export const frameSrc = async (viewer: Locator): Promise<string> => {
  const frame = viewer.locator('[data-pdf-viewer-frame]')
  await expect(frame).toHaveAttribute('src', /^blob:/)
  return (await frame.getAttribute('src')) ?? ''
}

/** Fetches a blob URL inside the page and reads the header and page count of the PDF. */
export const readPdf = (page: Page, url: string) =>
  page.evaluate(async (src) => {
    const text = await (await fetch(src)).text()
    return {
      header: text.slice(0, 5),
      pages: Number(/\/Type \/Pages\s*\/Count (\d+)/.exec(text)?.[1] ?? 0),
    }
  }, url)

/** Fails the test on uncaught errors and console errors. */
export const watchErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/**
 * Waits for the download with this file name. Headless Chromium has no PDF viewer, so
 * every preview frame that loads a PDF also shows up as a download, named after the blob.
 */
export const waitForDownload = (page: Page, fileName: string): Promise<Download> =>
  page.waitForEvent('download', (download) => download.suggestedFilename() === fileName)
