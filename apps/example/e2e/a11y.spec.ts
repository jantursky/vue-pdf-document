import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// WCAG 2.2 A and AA. The PDF frames are left out: they show the browser's own viewer.
const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('iframe')
    .exclude('object')
    .analyze()
  return violations.map(
    ({ id, help, nodes }) => `${id}: ${help} (${nodes.map((node) => node.target.join(' ')).join(', ')})`,
  )
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test('the overview has no accessibility violations', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('#example-minimal [data-pdf-viewer-frame]')).toBeVisible()
      await page.locator('#example-invoice').getByRole('button', { name: 'View source' }).click()
      expect(await audit(page)).toEqual([])
    })

    test('the invoice generator has no accessibility violations', async ({ page }) => {
      await page.goto('/#generator')
      await expect(page.locator('[data-status]')).toHaveText(/^Ready/, { timeout: 15_000 })
      expect(await audit(page)).toEqual([])
    })
  })
}
