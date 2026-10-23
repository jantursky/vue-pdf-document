import { defineComponent, Fragment, h, isVNode, type AppContext, type VNodeChild } from 'vue'

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

/** The document app's context, carried to vnodes that render props return. */
type Context = AppContext | null

/** A parent for render-prop content, so its components inherit the document's app context. */
const ContextRoot = defineComponent(
  (_, { slots }) =>
    () =>
      slots.default?.(),
)

/**
 * Turns whatever a `render` prop or slot returns into layout nodes. Layout calls these
 * functions while it paginates, long after Vue has patched the tree, so vnodes are
 * mounted into a throwaway container, copied out, and unmounted again.
 */
export const toLayoutNodes = (value: VNodeChild, context: Context = null): LayoutNode[] => {
  if (value == null || typeof value === 'boolean') return []
  if (typeof value === 'string' || typeof value === 'number') return [textInstance(`${value}`)]
  const container = createRoot()
  const content = isVNode(value) ? value : h(Fragment, value as VNodeChild[])
  // Components below a root vnode take their context from their parent instance, so the
  // context goes on a wrapping component rather than on the content itself.
  const root = h(ContextRoot, null, { default: () => content })
  root.appContext = context
  renderer.render(root, container)
  const nodes = convertChildren(container, true, context)
  renderer.render(null, container)
  return nodes
}

const wrapRenderProp = (props: Props, context: Context): Props => {
  const { render } = props
  if (typeof render !== 'function') return props
  return {
    ...props,
    render: (args: unknown) => toLayoutNodes((render as (args: unknown) => VNodeChild)(args), context),
  }
}

const convertChildren = (parent: PdfElement, allowText: boolean, context: Context): LayoutNode[] => {
  const result: LayoutNode[] = []
  for (const child of parent.children) {
    const node = convert(child, allowText, context)
    if (node) result.push(node)
  }
  return result
}

const convert = (node: PdfNode, allowText: boolean, context: Context): LayoutNode | null => {
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
  return convertElement(node, context)
}

const convertElement = (node: PdfElement, context: Context): LayoutNode => ({
  type: node.type,
  box: {},
  style: node.style ?? {},
  props: wrapRenderProp({ ...node.props }, context),
  children: convertChildren(node, TEXT_PARENTS.has(node.type), context),
})

/**
 * Copies the mounted tree into a fresh layout input. Layout annotates the nodes it
 * receives, so it never sees the live tree Vue keeps patching.
 */
export const snapshot = (root: PdfElement, context: Context = null): LayoutNode => {
  const document = root.children.find((child) => child.kind === 'element')
  if (document?.kind !== 'element' || document.type !== 'DOCUMENT') {
    throw new Error('[vue-pdf-document] The root component must render a single <Document>.')
  }
  return convertElement(document, context)
}
