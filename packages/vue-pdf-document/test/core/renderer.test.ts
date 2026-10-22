import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { Text, View } from '../../src'
import { createElementNode, createRoot, type PdfElement } from '../../src/core/nodes'
import { nodeOps, renderer } from '../../src/core/renderer'
import { snapshot, toLayoutNodes } from '../../src/core/snapshot'
import Invoice from '../fixtures/Invoice.vue'
import { singlePage } from '../fixtures'

const mount = (component: Parameters<typeof renderer.createApp>[0], props?: Record<string, unknown>) => {
  const root = createRoot()
  const app = renderer.createApp(component, props)
  app.mount(root)
  return { root, app }
}

const page = (root: PdfElement) => {
  const document = snapshot(root)
  return document.children![0]!
}

describe('node operations', () => {
  it('inserts before an anchor and moves nodes between parents', () => {
    const a = createElementNode('VIEW')
    const b = createElementNode('VIEW')
    const parent = createElementNode('PAGE')
    const other = createElementNode('PAGE')
    nodeOps.insert(a, parent)
    nodeOps.insert(b, parent, a)
    expect(parent.children).toEqual([b, a])
    expect(nodeOps.nextSibling(b)).toBe(a)
    expect(nodeOps.nextSibling(a)).toBeNull()
    nodeOps.insert(b, other)
    expect(parent.children).toEqual([a])
    expect(nodeOps.parentNode(b)).toBe(other)
  })

  it('removes nodes and ignores ones without a parent', () => {
    const child = createElementNode('VIEW')
    const parent = createElementNode('PAGE')
    nodeOps.insert(child, parent)
    nodeOps.remove(child)
    nodeOps.remove(child)
    expect(parent.children).toEqual([])
    expect(nodeOps.nextSibling(child)).toBeNull()
  })

  it('replaces children with element text', () => {
    const text = createElementNode('TEXT')
    nodeOps.insert(nodeOps.createText('old'), text)
    nodeOps.setElementText(text, 'new')
    expect(text.children).toMatchObject([{ kind: 'text', value: 'new' }])
    nodeOps.setElementText(text, '')
    expect(text.children).toEqual([])
  })

  it('camelizes props and style keys and drops class', () => {
    const view = createElementNode('VIEW')
    nodeOps.patchProp(view, 'min-presence-ahead', undefined, 10)
    nodeOps.patchProp(view, 'style', undefined, { 'font-size': 12, color: 'red' })
    nodeOps.patchProp(view, 'class', undefined, 'ignored')
    expect(view.props).toEqual({ minPresenceAhead: 10 })
    expect(view.style).toEqual({ fontSize: 12, color: 'red' })
    nodeOps.patchProp(view, 'min-presence-ahead', 10, undefined)
    expect(view.props).toEqual({})
  })

  it('notifies the root on every change below it', () => {
    const root = createRoot()
    root.onChange = vi.fn()
    const text = nodeOps.createText('a')
    const comment = nodeOps.createComment('v-if')
    nodeOps.insert(text, root)
    nodeOps.setText(text, 'b')
    nodeOps.setText(comment, 'ignored')
    nodeOps.setText(createElementNode('VIEW'), 'ignored')
    expect(root.onChange).toHaveBeenCalledTimes(2)
  })
})

describe('templates', () => {
  it('casts flags, camelizes attributes and drops v-if placeholders', () => {
    const { root } = mount(Invoice, { customer: 'Ada', items: [] })
    // The draft banner is behind `v-if` and the item list is empty, so two children are left.
    const [header, footer] = page(root).children!
    expect(page(root).children).toHaveLength(2)
    expect(page(root).style).toEqual({ padding: 30, fontSize: 12 })
    expect(header).toMatchObject({ type: 'VIEW', props: { minPresenceAhead: 20, wrap: false } })
    expect(footer).toMatchObject({ type: 'TEXT', props: { fixed: true }, children: [] })
    expect(footer!.props!.render).toBeTypeOf('function')
  })

  it('patches the tree when reactive data changes', async () => {
    const label = ref('one')
    const shown = ref(true)
    const Doc = singlePage(() => [shown.value ? h(Text, null, () => label.value) : null, h(View, { fixed: true })])
    const { root } = mount(Doc)
    expect(page(root).children).toMatchObject([{ type: 'TEXT', children: [{ value: 'one' }] }, { type: 'VIEW' }])
    label.value = 'two'
    await nextTick()
    expect(page(root).children![0]).toMatchObject({ children: [{ value: 'two' }] })
    shown.value = false
    await nextTick()
    expect(page(root).children).toMatchObject([{ type: 'VIEW', props: { fixed: true } }])
  })

  it('flattens style arrays the way Vue does for elements', () => {
    const { root } = mount(singlePage(() => h(View, { style: [{ padding: 4 }, false, { margin: 2 }] })))
    expect(page(root).children![0]!.style).toEqual({ padding: 4, margin: 2 })
  })
})

describe('toLayoutNodes', () => {
  it('turns render results into text instances or nodes', () => {
    expect(toLayoutNodes(null)).toEqual([])
    expect(toLayoutNodes(false)).toEqual([])
    expect(toLayoutNodes(3)).toEqual([{ type: 'TEXT_INSTANCE', value: '3' }])
    expect(toLayoutNodes([h(Text, null, () => 'a'), h(Text, null, () => 'b')])).toMatchObject([
      { type: 'TEXT', children: [{ value: 'a' }] },
      { type: 'TEXT', children: [{ value: 'b' }] },
    ])
  })

  it('renders a component returned from a render function', () => {
    const Child = defineComponent(() => () => h(Text, null, () => 'child'))
    expect(toLayoutNodes(h(Child))).toMatchObject([{ type: 'TEXT', children: [{ value: 'child' }] }])
  })
})
