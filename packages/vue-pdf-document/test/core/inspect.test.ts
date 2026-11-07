import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { Document, findById, findByText, Page, pdf, renderToBuffer, renderToLayout, Text, View } from '../../src'
import { toLayoutPages } from '../../src/core/inspect'
import type { LayoutNode } from '../../src/core/snapshot'
import { pageCount, singlePage } from '../fixtures'

const Report = defineComponent(
  () => () =>
    h(Document, null, () =>
      h(Page, { size: 'A4' }, () => [
        ...Array.from({ length: 80 }, (_, index) =>
          h(View, { style: { marginBottom: 12 } }, () => h(Text, null, () => `Line ${index + 1}`)),
        ),
        h(Text, { id: 'total' }, () => 'Total 42'),
      ]),
    ),
)

describe('toLayout', () => {
  it('gives the same page count as a PDF render', async () => {
    const bytes = await renderToBuffer(Report)
    const layout = await renderToLayout(Report)
    expect(layout.length).toBeGreaterThan(1)
    expect(layout).toHaveLength(pageCount(bytes))
    expect(layout.map((page) => page.pageNumber)).toEqual(layout.map((_, index) => index + 1))
  })

  it('updates pageCount on the instance and rejects after unmount', async () => {
    const instance = pdf(Report)
    expect(instance.pageCount).toBeNull()
    const layout = await instance.toLayout()
    expect(instance.pageCount).toBe(layout.length)
    instance.unmount()
    await expect(instance.toLayout()).rejects.toThrow('unmounted')
  })

  it('rejects with AbortError when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(renderToLayout(Report, undefined, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('places a fixed absolute footer relative to the page', async () => {
    const Doc = singlePage(() => [
      h(Text, null, () => 'Body'),
      h(Text, { id: 'footer', fixed: true, style: { position: 'absolute', bottom: 20 } }, () => 'Footer'),
    ])
    const layout = await renderToLayout(Doc)
    const [footer] = findById(layout, 'footer')
    expect(footer!.pageNumber).toBe(1)
    expect(footer!.box.top + footer!.box.height).toBeCloseTo(layout[0]!.height - 20, 1)
  })

  it('makes box positions page-relative for nested elements', async () => {
    const Doc = singlePage(() =>
      h(View, { style: { marginTop: 30, paddingTop: 10 } }, () => h(Text, { id: 'inner' }, () => 'Inner')),
    )
    const layout = await renderToLayout(Doc)
    const [inner] = findById(layout, 'inner')
    expect(inner!.box.top).toBeCloseTo(40, 1)
  })

  it('flattens nested text into the parent and keeps wrapped lines', async () => {
    const Doc = singlePage(() =>
      h(Text, { id: 'p', style: { width: 60 } }, () => ['Hello ', h(Text, null, () => 'brave new world')]),
    )
    const [node] = findById(await renderToLayout(Doc), 'p')
    expect(node!.children).toEqual([])
    expect(node!.text!.replace(/\n/g, ' ')).toBe('Hello brave new world')
    expect(node!.text).toContain('\n')
  })

  it('survives a JSON round trip', async () => {
    const layout = await renderToLayout(Report)
    expect(JSON.parse(JSON.stringify(layout))).toEqual(layout)
  })
})

describe('findByText and findById', () => {
  it('finds a string, a RegExp on the last page, and nothing', async () => {
    const layout = await renderToLayout(Report)
    expect(findByText(layout, 'Line 1')[0]!.pageNumber).toBe(1)
    const total = findByText(layout, /Total \d+/)
    expect(total).toHaveLength(1)
    expect(total[0]!.pageNumber).toBe(layout.length)
    expect(findByText(layout, 'nowhere')).toEqual([])
    expect(findById(layout, 'missing')).toEqual([])
  })

  it('returns matches in page and document order and survives global RegExps', async () => {
    const layout = await renderToLayout(Report)
    const found = findByText(layout, /Line \d+/g)
    expect(found).toHaveLength(80)
    expect(found.map((node) => node.pageNumber)).toEqual([...found.map((node) => node.pageNumber)].sort())
  })
})

describe('toLayoutPages', () => {
  const laid = (node: object) => node as LayoutNode

  it('fills in missing boxes, lines and ids, and skips bare strings', () => {
    const layout = toLayoutPages(
      laid({
        type: 'DOCUMENT',
        children: [
          { type: 'PAGE', box: { width: 100.004, height: 200 }, children: [{ type: 'TEXT_INSTANCE', value: 'x' }] },
          {
            type: 'PAGE',
            children: [
              { type: 'VIEW', props: { id: 7 }, box: { left: 1.234, top: 2 }, children: [{ type: 'TEXT_INSTANCE' }] },
              { type: 'TEXT', props: { id: {} }, box: { width: 5 } },
              { type: 'TEXT', lines: [{ string: 'a  ' }, {}] },
            ],
          },
        ],
      }),
    )
    expect(layout[0]).toEqual({ pageNumber: 1, width: 100, height: 200, nodes: [] })
    expect(layout[1]!.width).toBe(0)
    const [view, empty, text] = layout[1]!.nodes
    expect(view).toEqual({ type: 'VIEW', id: '7', box: { left: 1.23, top: 2, width: 0, height: 0 }, children: [] })
    expect(empty!.id).toBeUndefined()
    expect(empty!.text).toBe('')
    expect(text!.text).toBe('a\n')
  })

  it('handles a document without pages', () => {
    expect(toLayoutPages(laid({ type: 'DOCUMENT' }))).toEqual([])
  })
})
