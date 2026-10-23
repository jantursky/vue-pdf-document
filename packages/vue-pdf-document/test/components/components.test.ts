import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, nextTick, provide, type VNode } from 'vue'

import { Page, PdfDownloadLink, PdfViewer, Text } from '../../src'
import { pdfText, singlePage } from '../fixtures'

const Doc = singlePage(() => h(Text, null, () => 'hi'))
const wrappers: { unmount: () => void }[] = []

const until = (condition: () => boolean) =>
  vi.waitFor(() => {
    if (!condition()) throw new Error('not yet')
  })

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('PdfViewer', () => {
  it('shows the loading slot, then an iframe with the file', async () => {
    const wrapper = mount(PdfViewer, { props: { document: Doc }, slots: { loading: 'Rendering…' } })
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('Rendering…')
    expect(wrapper.attributes('data-loading')).toBe('true')
    await until(() => wrapper.find('iframe').exists())
    await nextTick()
    const frame = wrapper.find('iframe')
    expect(frame.attributes('src')).toMatch(/^blob:/)
    expect(frame.attributes('title')).toBe('PDF preview')
    expect(wrapper.attributes('data-loading')).toBeUndefined()
  })

  it('shows the error slot when rendering fails', async () => {
    const wrapper = mount(PdfViewer, {
      props: { document: defineComponent(() => () => h(Page)) },
      slots: { error: ({ error }: { error: unknown }) => `Failed: ${(error as Error).message}` },
    })
    wrappers.push(wrapper)
    await until(() => wrapper.text().startsWith('Failed'))
    expect(wrapper.text()).toContain('<Document>')
    expect(wrapper.emitted('error')?.[0]?.[0]).toBeInstanceOf(Error)
  })

  it('emits rendered with the file, its URL and page count', async () => {
    const wrapper = mount(PdfViewer, { props: { document: Doc } })
    wrappers.push(wrapper)
    await until(() => wrapper.emitted('rendered') !== undefined)
    const [[result]] = wrapper.emitted('rendered') as [[{ blob: Blob; url: string; pageCount: number }]]
    expect(result.blob.type).toBe('application/pdf')
    expect(result.url).toMatch(/^blob:/)
    expect(result.pageCount).toBe(1)
    expect(wrapper.emitted('rendered')).toHaveLength(1)
  })

  it('renders nothing while disabled', async () => {
    const wrapper = mount(PdfViewer, { props: { document: Doc, enabled: false }, slots: { loading: 'Waiting' } })
    wrappers.push(wrapper)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.attributes('data-loading')).toBeUndefined()
    await wrapper.setProps({ enabled: true })
    await until(() => wrapper.find('iframe').exists())
  })

  it('leaves the URL without a fragment by default', async () => {
    const wrapper = mount(PdfViewer, { props: { document: Doc } })
    wrappers.push(wrapper)
    await until(() => wrapper.find('iframe').exists())
    expect(wrapper.find('iframe').attributes('src')).not.toContain('#')
  })

  it('passes page, zoom and toolbar to the viewer in the fragment', async () => {
    const wrapper = mount(PdfViewer, { props: { document: Doc, page: 3, toolbar: false } })
    wrappers.push(wrapper)
    await until(() => wrapper.find('iframe').exists())
    expect(wrapper.find('iframe').attributes('src')).toMatch(/^blob:.*#page=3&toolbar=0$/)
    await wrapper.setProps({ zoom: 'page-width', toolbar: true })
    expect(wrapper.find('iframe').attributes('src')).toMatch(/#page=3&zoom=page-width&toolbar=1$/)
  })
})

describe('PdfDownloadLink', () => {
  it('links to the file once it is ready', async () => {
    const wrapper = mount(PdfDownloadLink, { props: { document: Doc, fileName: 'hi.pdf' } })
    wrappers.push(wrapper)
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toBe('Download PDF')
    await until(() => wrapper.attributes('href') !== undefined)
    expect(wrapper.attributes('href')).toMatch(/^blob:/)
    expect(wrapper.attributes('download')).toBe('hi.pdf')
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
  })

  it('passes the state to the default slot', async () => {
    const wrapper = mount(PdfDownloadLink, {
      props: { document: Doc },
      slots: { default: ({ loading }: { loading: boolean }) => (loading ? 'Preparing' : 'Ready') },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('Preparing')
    await until(() => wrapper.text() === 'Ready')
  })

  it('emits rendered and error', async () => {
    const ok = mount(PdfDownloadLink, { props: { document: Doc } })
    const broken = mount(PdfDownloadLink, { props: { document: defineComponent(() => () => h(Page)) } })
    wrappers.push(ok, broken)
    await until(() => ok.emitted('rendered') !== undefined && broken.emitted('error') !== undefined)
    expect((ok.emitted('rendered')![0]![0] as { pageCount: number }).pageCount).toBe(1)
  })
})

describe('PdfDownloadLink lazy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never renders without interaction', async () => {
    const wrapper = mount(PdfDownloadLink, { props: { document: Doc, lazy: true } })
    wrappers.push(wrapper)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.emitted('rendered')).toBeUndefined()
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('role')).toBe('link')
  })

  it('renders on hover', async () => {
    const wrapper = mount(PdfDownloadLink, { props: { document: Doc, lazy: true } })
    wrappers.push(wrapper)
    await wrapper.trigger('pointerenter')
    await until(() => wrapper.attributes('href') !== undefined)
    expect(wrapper.attributes('tabindex')).toBeUndefined()
  })

  it('holds a click until the file is ready, then downloads once', async () => {
    const clicks: { href: string; download: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download })
    })
    const wrapper = mount(PdfDownloadLink, { props: { document: Doc, lazy: true, fileName: 'lazy.pdf' } })
    wrappers.push(wrapper)
    await wrapper.trigger('click')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
    await until(() => clicks.length > 0)
    await nextTick()
    expect(clicks).toEqual([{ href: wrapper.attributes('href'), download: 'lazy.pdf' }])
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })

  it('starts on Enter from the keyboard', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(PdfDownloadLink, { props: { document: Doc, lazy: true } })
    wrappers.push(wrapper)
    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    await until(() => wrapper.attributes('href') !== undefined)
  })
})

describe('server-side rendering', () => {
  it('renders the loading state without starting the engine', async () => {
    const { renderToString } = await import('vue/server-renderer')
    const { createSSRApp } = await import('vue')
    const html = await renderToString(
      createSSRApp({ render: () => h(PdfViewer, { document: Doc }, { loading: () => 'Rendering…' }) }),
    )
    expect(html).toContain('Rendering…')
    expect(html).not.toContain('<iframe')
  })
})

describe('inherit-context', () => {
  const Theme = defineComponent(() => {
    const theme = inject('theme', 'none')
    return () => h(Text, null, () => `Theme: ${theme}`)
  })
  const ThemedDoc = singlePage(() => h(Theme))

  const provider = (child: () => VNode) =>
    defineComponent(() => {
      provide('theme', 'dark')
      return child
    })

  it('lets PdfViewer documents inject from the page', async () => {
    let blob: Blob | undefined
    const wrapper = mount(
      provider(() =>
        h(PdfViewer, {
          document: ThemedDoc,
          inheritContext: true,
          onRendered: (result: { blob: Blob }) => (blob = result.blob),
        }),
      ),
    )
    wrappers.push(wrapper)
    await until(() => blob !== undefined)
    expect(pdfText(new Uint8Array(await blob!.arrayBuffer()))).toContain('Theme: dark')
  })

  it('lets PdfDownloadLink documents inject from the page', async () => {
    let blob: Blob | undefined
    const wrapper = mount(
      provider(() =>
        h(PdfDownloadLink, {
          document: ThemedDoc,
          inheritContext: true,
          onRendered: (result: { blob: Blob }) => (blob = result.blob),
        }),
      ),
    )
    wrappers.push(wrapper)
    await until(() => blob !== undefined)
    expect(pdfText(new Uint8Array(await blob!.arrayBuffer()))).toContain('Theme: dark')
  })

  it('stays isolated without the prop', async () => {
    let blob: Blob | undefined
    const wrapper = mount(
      provider(() =>
        h(PdfViewer, { document: ThemedDoc, onRendered: (result: { blob: Blob }) => (blob = result.blob) }),
      ),
    )
    wrappers.push(wrapper)
    await until(() => blob !== undefined)
    expect(pdfText(new Uint8Array(await blob!.arrayBuffer()))).toContain('Theme: none')
  })
})
