import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { Page, PdfDownloadLink, PdfViewer, Text } from '../../src'
import { singlePage } from '../fixtures'

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
