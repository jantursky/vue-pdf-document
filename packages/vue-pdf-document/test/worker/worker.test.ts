import { afterEach, describe, expect, it, vi } from 'vitest'
import { type App, defineComponent, effectScope, h, nextTick, reactive, ref } from 'vue'

import { Document, Page, PdfRenderError, Text } from '../../src'
import { createPdfWorker, exposeDocuments, useWorkerPdf } from '../../src/worker'
import { toCloneable } from '../../src/worker/clone'
import { pdfText } from '../fixtures'

const Hello = defineComponent({
  props: { customer: { type: String, default: 'nobody' }, items: { type: Array as () => string[], default: () => [] } },
  setup: (props) => () =>
    h(Document, null, () =>
      h(Page, null, () => [
        h(Text, null, () => `Hello ${props.customer}`),
        ...props.items.map((item) => h(Text, null, () => item)),
      ]),
    ),
})
const Broken = defineComponent(() => () => h('div'))

const closers: (() => void)[] = []

const connect = (setup?: (app: App) => void) => {
  const { port1, port2 } = new MessageChannel()
  exposeDocuments({ hello: Hello, broken: Broken }, { port: port2, setup })
  const client = createPdfWorker<{ hello: typeof Hello; broken: typeof Broken }>(port1)
  closers.push(() => {
    client.terminate()
    port2.close()
  })
  return client
}

const textOf = async (blob: Blob) => pdfText(new Uint8Array(await blob.arrayBuffer())).join(' ')

afterEach(() => {
  closers.splice(0).forEach((close) => close())
  vi.restoreAllMocks()
})

describe('exposeDocuments and createPdfWorker', () => {
  it('renders a document by name', async () => {
    const blob = await connect().render('hello', { customer: 'Ada' })
    expect(blob.type).toBe('application/pdf')
    expect(await textOf(blob)).toContain('Ada')
  })

  it('applies setup to every document app', async () => {
    const setup = vi.fn()
    await connect(setup).render('hello')
    expect(setup).toHaveBeenCalledOnce()
  })

  it('rejects an unknown name with the registered names', async () => {
    const client = connect() as unknown as { render: (name: string) => Promise<Blob> }
    await expect(client.render('invoce')).rejects.toThrow(/hello, broken/)
  })

  it('rebuilds a render error with its phase', async () => {
    const error = await connect()
      .render('broken')
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PdfRenderError)
    expect((error as PdfRenderError).phase).toBeDefined()
  })

  it('resolves concurrent renders independently', async () => {
    const client = connect()
    const [a, b] = await Promise.all([
      client.render('hello', { customer: 'Ada' }),
      client.render('hello', { customer: 'Bob' }),
    ])
    expect(await textOf(a)).toContain('Ada')
    expect(await textOf(b)).toContain('Bob')
  })

  it('rejects an aborted render and still serves the next one', async () => {
    const client = connect()
    const controller = new AbortController()
    const first = client.render('hello', { customer: 'Ada' }, { signal: controller.signal })
    controller.abort()
    const second = client.render('hello', { customer: 'Bob' })
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(await textOf(await second)).toContain('Bob')
  })

  it('rejects at once when the signal is already aborted', async () => {
    await expect(connect().render('hello', {}, { signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('rejects pending renders on terminate and refuses new ones', async () => {
    const client = connect()
    const pending = client.render('hello')
    client.terminate()
    await expect(pending).rejects.toThrow(/terminated/)
    await expect(client.render('hello')).rejects.toThrow(/terminated/)
  })

  it('sends reactive props as plain data', async () => {
    const props = reactive({ customer: 'Ada', items: ['first', 'second'] })
    const text = await textOf(await connect().render('hello', props))
    expect(text).toContain('first')
    expect(text).toContain('second')
  })

  it('rejects a function prop with its path before posting', async () => {
    const client = connect()
    await expect(client.render('hello', { format: (n: number) => n } as never)).rejects.toThrow(/"format"/)
  })
})

describe('toCloneable', () => {
  it('unwraps refs and proxies at any depth and keeps cycles', () => {
    const inner = reactive({ list: [ref(1), { n: ref(2) }] })
    const cyclic: Record<string, unknown> = { inner }
    cyclic.self = cyclic
    const copy = toCloneable(cyclic) as { inner: { list: unknown[] }; self: unknown }
    expect(copy.inner.list).toEqual([1, { n: 2 }])
    expect(copy.self).toBe(copy)
    expect(() => structuredClone(copy)).not.toThrow()
  })

  it('names the path of the first non-cloneable value', () => {
    expect(() => toCloneable({ rows: [{ fn: () => 1 }] })).toThrow(/"rows\[0\]\.fn".*function/)
    expect(() => toCloneable({ a: Symbol('x') })).toThrow(/"a".*symbol/)
    expect(() => toCloneable({ el: document.createElement('div') })).toThrow(/"el".*DOM node/)
  })

  it('passes dates, maps, sets and typed arrays through', () => {
    const copy = toCloneable({
      d: new Date(0),
      m: new Map([['k', ref(1)]]),
      s: new Set([1]),
      u: new Uint8Array(2),
    }) as {
      m: Map<string, number>
    }
    expect(copy.m.get('k')).toBe(1)
    expect(() => structuredClone(copy)).not.toThrow()
  })
})

describe('useWorkerPdf', () => {
  const setup = <T>(run: () => T) => {
    const scope = effectScope()
    const result = scope.run(run)!
    closers.push(() => scope.stop())
    return result
  }
  const until = (condition: () => boolean) =>
    vi.waitFor(() => {
      if (!condition()) throw new Error('not yet')
    })

  it('renders in the worker and follows a reactive prop', async () => {
    const client = connect()
    const props = reactive({ customer: 'Ada' })
    const result = setup(() => useWorkerPdf(client, 'hello', props, { debounce: 10 }))
    expect(result.loading.value).toBe(true)
    await until(() => !result.loading.value && result.blob.value !== null)
    expect(result.pageCount.value).toBe(1)
    expect(result.url.value).toMatch(/^blob:/)
    expect(await textOf(result.blob.value!)).toContain('Ada')

    props.customer = 'Bob'
    await nextTick()
    await until(() => result.blob.value !== null && !result.loading.value)
    await vi.waitFor(async () => expect(await textOf(result.blob.value!)).toContain('Bob'))
  })

  it('renders nothing until enabled', async () => {
    const client = connect()
    const render = vi.spyOn(client, 'render')
    const enabled = ref(false)
    const result = setup(() => useWorkerPdf(client, 'hello', { customer: 'Ada' }, { enabled }))
    expect(result.loading.value).toBe(false)
    expect(render).not.toHaveBeenCalled()
    enabled.value = true
    await until(() => result.blob.value !== null)
    expect(render).toHaveBeenCalledOnce()
  })

  it('keeps only the newest render', async () => {
    const client = connect()
    const props = ref({ customer: 'a' })
    const result = setup(() => useWorkerPdf(client, 'hello', props, { debounce: 0 }))
    await until(() => result.blob.value !== null)
    props.value = { customer: 'b' }
    await nextTick()
    props.value = { customer: 'c' }
    await nextTick()
    await vi.waitFor(async () => expect(await textOf(result.blob.value!)).toContain('Hello c'))
    expect(result.error.value).toBeNull()
  })

  it('reports an error from the worker', async () => {
    const client = connect()
    const result = setup(() => useWorkerPdf(client, 'broken' as 'hello'))
    await until(() => result.error.value !== null)
    expect(result.error.value).toBeInstanceOf(PdfRenderError)
  })

  it('posts nothing when rendered on the server', async () => {
    const { renderToString } = await import('vue/server-renderer')
    const { createSSRApp } = await import('vue')
    const client = connect()
    const render = vi.spyOn(client, 'render')
    const App = defineComponent(() => {
      useWorkerPdf(client, 'hello', { customer: 'Ada' })
      return () => h('div')
    })
    await renderToString(createSSRApp(App))
    expect(render).not.toHaveBeenCalled()
  })
})
