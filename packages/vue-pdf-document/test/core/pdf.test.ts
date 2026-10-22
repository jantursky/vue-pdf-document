import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onUnmounted, ref } from 'vue'

import {
  Document,
  Font,
  Image,
  Page,
  pdf,
  PdfRenderError,
  renderToBlob,
  renderToBuffer,
  renderToStream,
  Text,
  View,
} from '../../src'
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

describe('render errors', () => {
  it('reports a missing Document as a snapshot error', async () => {
    const error: unknown = await renderToBuffer(defineComponent(() => () => h(Page))).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PdfRenderError)
    expect(error).toMatchObject({ phase: 'snapshot', name: 'PdfRenderError' })
    expect((error as Error).message).toMatch(/^\[vue-pdf-document\] The root component/)
    expect((error as Error).cause).toBeInstanceOf(Error)
  })

  it('reports an unregistered font as a layout error', async () => {
    const Doc = singlePage(() => h(Text, { style: { fontFamily: 'Nowhere Sans' } }, () => 'Hi'))
    const error: unknown = await renderToBuffer(Doc).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PdfRenderError)
    expect(error).toMatchObject({ phase: 'layout' })
    expect((error as Error).message).toMatch(/^\[vue-pdf-document\] Font family not registered: Nowhere Sans/)
    expect(((error as Error).cause as Error).message).toContain('Font family not registered')
  })

  it('reports a render after unmount as a snapshot error', async () => {
    const instance = pdf(singlePage(() => null))
    instance.unmount()
    await expect(instance.toBlob()).rejects.toMatchObject({ phase: 'snapshot' })
  })
})

/** An image whose source holds layout open until `release()`. Later requests resolve at once. */
const pendingImage = () => {
  const waiting: (() => void)[] = []
  let blocked = true
  const uri = () => `data:image/png;base64,${PNG}`
  const src = () =>
    blocked ? new Promise<string>((resolve) => waiting.push(() => resolve(uri()))) : Promise.resolve(uri())
  return {
    Doc: singlePage(() => h(Image, { src, cache: false, style: { width: 10, height: 10 } })),
    /** Resolves once layout has asked for the image. */
    requested: () => vi.waitFor(() => expect(waiting.length).toBeGreaterThan(0)),
    release: () => {
      blocked = false
      for (const resolve of waiting.splice(0)) resolve()
    },
  }
}
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

describe('cancellation', () => {
  it('rejects with AbortError before layout when the signal is already aborted', async () => {
    const onRender = vi.fn()
    const instance = pdf(defineComponent(() => () => h(Document, { onRender }, () => h(Page))))
    const error: unknown = await instance.toBlob({ signal: AbortSignal.abort() }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ name: 'AbortError' })
    expect(error).not.toBeInstanceOf(PdfRenderError)
    expect(onRender).not.toHaveBeenCalled()
    expect(instance.pageCount).toBeNull()
    instance.unmount()
  })

  it('aborts during layout and renders again afterwards', async () => {
    const { Doc, requested, release } = pendingImage()
    const instance = pdf(Doc)
    const controller = new AbortController()
    const pending = instance.toBuffer({ signal: controller.signal })
    await requested()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    release()
    expect(instance.pageCount).toBeNull()

    const next = instance.toBuffer()
    expect(new TextDecoder('latin1').decode((await next).subarray(0, 5))).toBe('%PDF-')
    expect(instance.pageCount).toBe(1)
    instance.unmount()
  })

  it('accepts a signal in the one-shot functions', async () => {
    const signal = AbortSignal.abort()
    await expect(renderToBuffer(Invoice, { customer: 'Ada', items: [] }, { signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    await expect(renderToBlob(Invoice, { customer: 'Ada', items: [] }, { signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array[]> => {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(next.value)
  return chunks
}

const join = (chunks: Uint8Array[]) => Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))

describe('streaming', () => {
  const fixed = new Date('2026-01-01T00:00:00Z')
  const Dated = defineComponent(
    () => () => h(Document, { creationDate: fixed }, () => h(Page, null, () => h(Text, null, () => 'Streamed text'))),
  )

  it('streams the same bytes toBuffer returns', async () => {
    const instance = pdf(Dated)
    const streamed = join(await readAll(instance.toStream()))
    const buffered = Buffer.from(await instance.toBuffer())
    expect(streamed.equals(buffered)).toBe(true)
    expect(instance.pageCount).toBe(1)
    instance.unmount()
  })

  it('renders once to a stream in Node and unmounts afterwards', async () => {
    const unmounted = vi.fn()
    const Doc = defineComponent(() => {
      onUnmounted(unmounted)
      return () => h(Dated)
    })
    const bytes = join(await readAll(renderToStream(Doc)))
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(bytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pdfText(bytes)).toContain('Streamed text')
    expect(unmounted).toHaveBeenCalledOnce()
  })

  it('stops and unmounts when the consumer cancels', async () => {
    const unmounted = vi.fn()
    const Doc = defineComponent(() => {
      onUnmounted(unmounted)
      return () => h(Invoice, { customer: 'Ada', items: items(80) })
    })
    const reader = renderToStream(Doc).getReader()
    const first = await reader.read()
    expect(first.done).toBe(false)
    await reader.cancel()
    expect(unmounted).toHaveBeenCalledOnce()
    expect((await reader.read()).done).toBe(true)
  })

  it('errors the stream when the caller aborts', async () => {
    const { Doc, requested, release } = pendingImage()
    const controller = new AbortController()
    const reader = renderToStream(Doc, undefined, { signal: controller.signal }).getReader()
    const pending = reader.read()
    await requested()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    release()
  })

  it('errors the stream with a PdfRenderError', async () => {
    const reader = renderToStream(defineComponent(() => () => h(Page))).getReader()
    await expect(reader.read()).rejects.toBeInstanceOf(PdfRenderError)
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
    expect(onRender).toHaveBeenCalledWith({ blob, pageCount: 1 })
  })

  it('counts the pages of the last finished render', async () => {
    const count = ref(2)
    const instance = pdf(Invoice, () => ({ customer: 'Ada', items: items(count.value) }))
    expect(instance.pageCount).toBeNull()
    await instance.toBuffer()
    expect(instance.pageCount).toBe(1)
    count.value = 80
    await nextTick()
    await instance.toBuffer()
    expect(instance.pageCount).toBe(2)
    instance.unmount()
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
