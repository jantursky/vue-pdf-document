import type { LayoutNode } from './snapshot'

/** Position and size in points, relative to the page's top-left corner. */
export interface LayoutBox {
  left: number
  top: number
  width: number
  height: number
}

/** One laid-out element: a plain, JSON-serializable view of what the engine placed. */
export interface LayoutItem {
  /** The element type, such as `'VIEW'`, `'TEXT'` or `'IMAGE'`. */
  type: string
  /** The element's `id` prop, when it has one. */
  id?: string
  box: LayoutBox
  /** For text elements, the laid-out lines joined with `\n`. Nested text is flattened into it. */
  text?: string
  children: LayoutItem[]
}

export interface LayoutPage {
  pageNumber: number
  width: number
  height: number
  /** The page's top-level elements, in document order. `fixed` elements appear once per page. */
  nodes: LayoutItem[]
}

/** The computed layout of a document, one entry per page. */
export type Layout = LayoutPage[]

/** An element found by a query helper, with the page it sits on. */
export type LayoutMatch = LayoutItem & { pageNumber: number }

interface Laid extends Omit<LayoutNode, 'children' | 'box'> {
  box?: Partial<LayoutBox>
  lines?: { string?: string }[]
  children?: Laid[]
}

// Bare strings outside a text element carry no box of their own.
const isBareString = (node: Laid): boolean => node.type === 'TEXT_INSTANCE'

// 0.01 pt keeps snapshots stable across platforms with tiny float differences.
const round = (value: number | undefined): number => Math.round((value ?? 0) * 100) / 100

const item = (node: Laid, left: number, top: number): LayoutItem => {
  const x = left + (node.box?.left ?? 0)
  const y = top + (node.box?.top ?? 0)
  const result: LayoutItem = {
    type: node.type,
    box: { left: round(x), top: round(y), width: round(node.box?.width), height: round(node.box?.height) },
    children: [],
  }
  const id = node.props?.id
  if (typeof id === 'string' || typeof id === 'number') result.id = String(id)
  if (node.type === 'TEXT') {
    result.text = (node.lines ?? []).map((line) => (line.string ?? '').trimEnd()).join('\n')
    return result
  }
  for (const child of node.children ?? []) {
    if (!isBareString(child)) result.children.push(item(child, x, y))
  }
  return result
}

/** Maps the engine's laid-out document to the documented, serializable shape. */
export const toLayoutPages = (laidOut: LayoutNode): Layout =>
  ((laidOut.children ?? []) as Laid[]).map((page, index) => ({
    pageNumber: index + 1,
    width: round(page.box?.width),
    height: round(page.box?.height),
    // Boxes are relative to their parent, so the offsets add up from the page down.
    nodes: (page.children ?? []).filter((child) => !isBareString(child)).map((child) => item(child, 0, 0)),
  }))

const collect = (layout: Layout, matches: (node: LayoutItem) => boolean): LayoutMatch[] => {
  const found: LayoutMatch[] = []
  const visit = (node: LayoutItem, pageNumber: number) => {
    if (matches(node)) found.push({ ...node, pageNumber })
    for (const child of node.children) visit(child, pageNumber)
  }
  for (const page of layout) for (const node of page.nodes) visit(node, page.pageNumber)
  return found
}

/** Every text element whose text contains `query`, or matches it when it's a RegExp, in page and document order. */
export const findByText = (layout: Layout, query: string | RegExp): LayoutMatch[] =>
  collect(layout, (node) => {
    if (node.text === undefined) return false
    if (typeof query === 'string') return node.text.includes(query)
    query.lastIndex = 0
    return query.test(node.text)
  })

/** Every element with this `id`, in page and document order. */
export const findById = (layout: Layout, id: string): LayoutMatch[] => collect(layout, (node) => node.id === id)
