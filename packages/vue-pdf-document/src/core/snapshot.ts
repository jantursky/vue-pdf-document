import { Fragment, h, isVNode, type VNodeChild } from 'vue'

import { createRoot, TEXT_PARENTS, type PdfElement, type PdfNode, type Props } from './nodes'
import { renderer } from './renderer'

/** The node shape @react-pdf/layout reads. */
export interface LayoutNode {
  type: string
  props?: Props
  style?: unknown
  box?: Record<string, never>
  children?: LayoutNode[]
  value?: string
}

const textInstance = (value: string): LayoutNode => ({ type: 'TEXT_INSTANCE', value })

/**
 * Turns whatever a `render` prop or slot returns into layout nodes. Layout calls these
 * functions while it paginates, long after Vue has patched the tree, so vnodes are
 * mounted into a throwaway container, copied out, and unmounted again.
 */
export const toLayoutNodes = (value: VNodeChild): LayoutNode[] => {
  if (value == null || typeof value === 'boolean') return []
  if (typeof value === 'string' || typeof value === 'number') return [textInstance(`${value}`)]
  const container = createRoot()
  renderer.render(isVNode(value) ? value : h(Fragment, value as VNodeChild[]), container)
  const nodes = convertChildren(container, true)
  renderer.render(null, container)
  return nodes
}

const wrapRenderProp = (props: Props): Props => {
  const { render } = props
  if (typeof render !== 'function') return props
  return { ...props, render: (args: unknown) => toLayoutNodes((render as (args: unknown) => VNodeChild)(args)) }
}

const convertChildren = (parent: PdfElement, allowText: boolean): LayoutNode[] => {
  const result: LayoutNode[] = []
  for (const child of parent.children) {
    const node = convert(child, allowText)
    if (node) result.push(node)
  }
  return result
}

const convert = (node: PdfNode, allowText: boolean): LayoutNode | null => {
  if (node.kind === 'comment') return null
  if (node.kind === 'text') {
    // Fragments anchor themselves with empty text nodes, so those are dropped quietly.
    if (node.value === '') return null
    if (!allowText) {
      console.warn(`[vue-pdf-document] Text "${node.value}" outside <Text> is ignored.`)
      return null
    }
    return textInstance(node.value)
  }
  return convertElement(node)
}

const convertElement = (node: PdfElement): LayoutNode => ({
  type: node.type,
  box: {},
  style: node.style ?? {},
  props: wrapRenderProp({ ...node.props }),
  children: convertChildren(node, TEXT_PARENTS.has(node.type)),
})

/**
 * Copies the mounted tree into a fresh layout input. Layout annotates the nodes it
 * receives, so it never sees the live tree Vue keeps patching.
 */
export const snapshot = (root: PdfElement): LayoutNode => {
  const document = root.children.find((child) => child.kind === 'element')
  if (document?.kind !== 'element' || document.type !== 'DOCUMENT') {
    throw new Error('[vue-pdf-document] The root component must render a single <Document>.')
  }
  return convertElement(document)
}
