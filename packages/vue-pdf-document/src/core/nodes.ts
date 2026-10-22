/**
 * The tree the Vue renderer builds. It mirrors the node shape @react-pdf/layout reads
 * (`type`, `props`, `style`, `children`, `value`), plus the parent links and comment
 * nodes Vue needs to patch it. `snapshot()` turns it into a clean layout input.
 */

export type Props = Record<string, unknown>

export interface PdfElement {
  kind: 'element'
  /** A @react-pdf/primitives type such as `VIEW`, or `ROOT` for a mount container. */
  type: string
  props: Props
  style: unknown
  children: PdfNode[]
  parent: PdfElement | null
}

export interface PdfTextNode {
  kind: 'text'
  value: string
  parent: PdfElement | null
}

/** Vue's `v-if` placeholders and fragment anchors. Dropped by `snapshot()`. */
export interface PdfCommentNode {
  kind: 'comment'
  value: string
  parent: PdfElement | null
}

export type PdfNode = PdfElement | PdfTextNode | PdfCommentNode

/** A mount container, notified after every change to the tree below it. */
export interface PdfRoot extends PdfElement {
  type: 'ROOT'
  onChange: (() => void) | null
}

export const ROOT = 'ROOT'

export const createElementNode = (type: string): PdfElement => ({
  kind: 'element',
  type,
  props: {},
  style: undefined,
  children: [],
  parent: null,
})

export const createRoot = (): PdfRoot => ({ ...createElementNode(ROOT), type: ROOT, onChange: null })

/** Primitives whose string children are laid out as text. Strings elsewhere are dropped. */
export const TEXT_PARENTS = new Set(['TEXT', 'LINK', 'TSPAN', 'NOTE'])
