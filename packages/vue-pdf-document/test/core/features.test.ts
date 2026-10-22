import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { Document, Image, Link, Page, Rect, renderToBuffer, Svg, Text, View } from '../../src'
import { pageCount, pdfText, singlePage } from '../fixtures'

// A 1×1 red PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

const raw = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1')

describe('react-pdf features through the Vue renderer', () => {
  it('embeds images from a data URI', async () => {
    const bytes = await renderToBuffer(singlePage(() => h(Image, { src: PNG, style: { width: 50, height: 50 } })))
    expect(raw(bytes)).toContain('/Subtype /Image')
  })

  it('writes link annotations', async () => {
    const bytes = await renderToBuffer(
      singlePage(() => h(Link, { src: 'https://example.com/docs' }, () => 'Read the docs')),
    )
    expect(raw(bytes)).toContain('/URI (https://example.com/docs)')
    expect(pdfText(bytes)).toContain('Read the docs')
  })

  it('draws SVG shapes', async () => {
    const empty = await renderToBuffer(singlePage(() => h(Svg, { width: 100, height: 100 })))
    const withRect = await renderToBuffer(
      singlePage(() =>
        h(Svg, { width: 100, height: 100, viewBox: '0 0 100 100' }, () =>
          h(Rect, { x: 10, y: 10, width: 80, height: 80, fill: 'tomato' }),
        ),
      ),
    )
    expect(withRect.length).toBeGreaterThan(empty.length)
  })

  it('adds bookmarks to the outline', async () => {
    const Doc = defineComponent(
      () => () =>
        h(Document, null, () => [
          h(Page, { bookmark: 'Chapter 1' }, () => h(Text, null, () => 'One')),
          h(Page, { bookmark: 'Chapter 2' }, () => h(Text, null, () => 'Two')),
        ]),
    )
    const bytes = await renderToBuffer(Doc)
    expect(pageCount(bytes)).toBe(2)
    expect(raw(bytes)).toContain('/Outlines')
    expect(raw(bytes)).toContain('(Chapter 2)')
  })

  it('breaks onto a new page with the break flag', async () => {
    const bytes = await renderToBuffer(
      singlePage(() => [h(Text, null, () => 'First'), h(View, { break: true }, () => h(Text, null, () => 'Second'))]),
    )
    expect(pageCount(bytes)).toBe(2)
  })

  it('encrypts the file when a user password is set', async () => {
    const Doc = defineComponent(
      () => () => h(Document, { userPassword: 'secret', ownerPassword: 'owner' }, () => h(Page)),
    )
    expect(raw(await renderToBuffer(Doc))).toContain('/Encrypt')
  })

  it('sets the page size and orientation', async () => {
    const Doc = defineComponent(() => () => h(Document, null, () => h(Page, { size: 'A4', orientation: 'landscape' })))
    // A4 landscape is 841.89 × 595.28 points.
    expect(raw(await renderToBuffer(Doc))).toMatch(/\/MediaBox \[0 0 841\.89\d* 595\.28\d*\]/)
  })
})
