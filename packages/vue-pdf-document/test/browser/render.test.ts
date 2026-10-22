import { describe, expect, it } from 'vitest'
import { defineComponent, effectScope, h } from 'vue'

import { Document, Page, renderToBlob, Text, usePdf, View } from '../../src'

const Doc = defineComponent(
  () => () =>
    h(Document, { title: 'Browser' }, () =>
      h(Page, { size: 'A4', style: { padding: 30 } }, () => [
        h(View, { style: { flexDirection: 'row', gap: 8 } }, () => [
          h(Text, null, () => 'Left'),
          h(Text, null, () => 'Right'),
        ]),
        h(Text, { fixed: true, render: ({ pageNumber }: { pageNumber: number }) => `Page ${pageNumber}` }),
      ]),
    ),
)

const header = async (blob: Blob) => new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer())

describe('in a real browser', () => {
  it('renders a document to a Blob with the browser build of pdfkit', async () => {
    const blob = await renderToBlob(Doc)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)
    expect(await header(blob)).toBe('%PDF-')
  })

  it('gives usePdf an object URL the browser can fetch', async () => {
    const scope = effectScope()
    const { url, loading } = scope.run(() => usePdf(Doc))!
    await expect.poll(() => loading.value, { timeout: 10_000 }).toBe(false)
    const response = await fetch(url.value!)
    expect(await header(await response.blob())).toBe('%PDF-')
    scope.stop()
  })
})
