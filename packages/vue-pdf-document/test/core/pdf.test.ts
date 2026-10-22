import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { Document, Font, Page, pdf, renderToBlob, renderToBuffer, Text, View } from '../../src'
import Invoice from '../fixtures/Invoice.vue'
import { pageCount, pdfInfo, pdfText, singlePage } from '../fixtures'

afterEach(() => {
  vi.restoreAllMocks()
})

const items = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `Item ${i}`, price: i }))

describe('renderToBuffer', () => {
  it('renders a PDF with the text of a template', async () => {
    const bytes = await renderToBuffer(Invoice, { customer: 'Ada', items: items(2) })
    expect(new TextDecoder('latin1').decode(bytes.subarray(0, 5))).toBe('%PDF-')
    expect(pageCount(bytes)).toBe(1)
    expect(pdfText(bytes)).toEqual(expect.arrayContaining(['Bill to Ada', 'Item 0: 0', 'Item 1: 1', '1 / 1']))
  })

  it('paginates, repeats fixed elements and numbers the pages from the render slot', async () => {
    const bytes = await renderToBuffer(Invoice, { customer: 'Ada', items: items(80), draft: true })
    expect(pageCount(bytes)).toBe(2)
    const text = pdfText(bytes)
    expect(text.filter((line) => line === 'DRAFT')).toHaveLength(2)
    expect(text).toEqual(expect.arrayContaining(['1 / 2', '2 / 2']))
  })

  it('writes the document metadata', async () => {
    const bytes = await renderToBuffer(Invoice, { customer: 'Ada', items: [] })
    expect(pdfInfo(bytes, 'Title')).toBe('Invoice')
    expect(pdfInfo(bytes, 'Author')).toBe('Test')
    expect(pdfInfo(bytes, 'Producer')).toBe('vue-pdf-document')
  })

  it('accepts a render prop that returns vnodes', async () => {
    const Doc = singlePage(() =>
      h(Text, { render: ({ pageNumber }: { pageNumber: number }) => h(Text, null, () => `Page ${pageNumber}`) }),
    )
    expect(pdfText(await renderToBuffer(Doc))).toContain('Page 1')
  })

  it('rejects a root that does not render a Document', async () => {
    const NotADocument = defineComponent(() => () => h(Page))
    await expect(renderToBuffer(NotADocument)).rejects.toThrow('must render a single <Document>')
  })
})

describe('pdf()', () => {
  it('follows reactive props and reports changes', async () => {
    const customer = ref('Ada')
    const instance = pdf(Invoice, () => ({ customer: customer.value, items: [] }))
    const onChange = vi.fn()
    instance.onChange(onChange)

    expect(pdfText(await instance.toBuffer())).toContain('Bill to Ada')
    customer.value = 'Grace'
    await nextTick()
    expect(onChange).toHaveBeenCalled()
    expect(pdfText(await instance.toBuffer())).toContain('Bill to Grace')
    instance.unmount()
  })

  it('stops reporting after the listener is removed', async () => {
    const label = ref('a')
    const instance = pdf(singlePage(() => h(Text, null, () => label.value)))
    const onChange = vi.fn()
    const stop = instance.onChange(onChange)
    stop()
    label.value = 'b'
    await nextTick()
    expect(onChange).not.toHaveBeenCalled()
    instance.unmount()
  })

  it('calls onRender with the blob', async () => {
    const onRender = vi.fn()
    const Doc = defineComponent(() => () => h(Document, { onRender }, () => h(Page)))
    const blob = await renderToBlob(Doc)
    expect(blob.type).toBe('application/pdf')
    expect(onRender).toHaveBeenCalledWith({ blob })
  })

  it('refuses to render after unmount', async () => {
    const instance = pdf(singlePage(() => null))
    instance.unmount()
    instance.unmount()
    await expect(instance.toBuffer()).rejects.toThrow('unmounted')
  })

  it('warns about text outside <Text> and leaves it out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bytes = await renderToBuffer(singlePage(() => h(View, null, () => 'loose')))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"loose" outside <Text>'))
    expect(pdfText(bytes)).not.toContain('loose')
  })
})

describe('Font', () => {
  it('forwards to react-pdf font store', () => {
    Font.registerHyphenationCallback((word) => [word])
    expect(Font.getHyphenationCallback()?.('unbreakable')).toEqual(['unbreakable'])
    expect(Font.getRegisteredFontFamilies()).toEqual(expect.any(Array))
  })
})
