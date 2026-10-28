import {
  cloneVNode,
  Comment,
  defineComponent,
  Fragment,
  h,
  inject,
  provide,
  Text as VueText,
  type InjectionKey,
  type SlotsType,
  type VNode,
} from 'vue'

import { Text, View } from '../primitives'
import type { PdfStyle, Style } from '../types'

/** A column width: points, a percentage string such as `'20%'`, or `'auto'` for an equal share of what is left. */
export type TableColumn = number | `${number}%` | 'auto'
export type TableBorder = number | { width?: number; color?: string }
export type TableAlign = 'left' | 'center' | 'right'

interface TableSettings {
  columns: TableColumn[]
  border: { width: number; color: string } | null
}

/** Where a row sits in its table. The table works it out from its slot, so it follows `v-if` and `v-for`. */
interface RowPosition {
  first: boolean
  shaded: boolean
}

// A getter, so a cell that reads it re-renders when the table's props change.
const tableKey: InjectionKey<() => TableSettings> = Symbol('table')

const STRIPE = '#f3f4f6'
const BORDER_COLOR = '#d1d5db'

/** A style object followed by the caller's `style`, which wins. */
const merge = (defaults: Style, style: PdfStyle | undefined): PdfStyle =>
  style ? [defaults, ...[style].flat()] : defaults

const columnStyle = (column: TableColumn | undefined): Style =>
  typeof column === 'number' || (column !== undefined && column !== 'auto')
    ? { width: column }
    : { flexGrow: 1, flexBasis: 0 }

const resolveBorder = (border: TableBorder | undefined): TableSettings['border'] => {
  if (border === undefined) return null
  if (typeof border === 'number') return { width: border, color: BORDER_COLOR }
  return { width: border.width ?? 0.5, color: border.color ?? BORDER_COLOR }
}

/** The slot's nodes with fragments (`v-for`, `v-if` groups) opened and empty `v-if` comments dropped. */
const flatten = (nodes: VNode[] | undefined): VNode[] =>
  (nodes ?? []).flatMap((node) =>
    node.type === Fragment && Array.isArray(node.children)
      ? flatten(node.children as VNode[])
      : node.type === Comment
        ? []
        : [node],
  )

/** Bare text inside a cell becomes a `Text`, so `<TableCell>Name</TableCell>` works. */
const withText = (nodes: VNode[]) =>
  nodes.map((node) =>
    node.type === VueText ? h(Text, null, () => (typeof node.children === 'string' ? node.children : '')) : node,
  )

interface TableProps {
  columns?: TableColumn[]
  border?: TableBorder
  /** Give every second body row a background. */
  striped?: boolean
  style?: PdfStyle
}

/**
 * A table whose header repeats on every page and whose rows stay whole. Widths come from
 * `columns`, applied to the cells of each row by position.
 */
export const Table = defineComponent(
  (props: TableProps, { attrs, slots }) => {
    provide(tableKey, () => ({ columns: props.columns ?? [], border: resolveBorder(props.border) }))
    return () => {
      const border = resolveBorder(props.border)
      const defaults: Style = border
        ? { borderWidth: border.width, borderColor: border.color, borderStyle: 'solid' }
        : {}
      let rows = 0
      let bodyRows = 0
      const children = flatten(slots.default?.()).map((node) => {
        if (node.type === TableHeader) return cloneVNode(node, { position: { first: rows++ === 0, shaded: false } })
        if (node.type !== TableRow) return node
        const position: RowPosition = { first: rows++ === 0, shaded: Boolean(props.striped) && bodyRows++ % 2 === 1 }
        return cloneVNode(node, { position })
      })
      return h(View, { ...attrs, style: merge(defaults, props.style) }, () => children)
    }
  },
  {
    name: 'Table',
    inheritAttrs: false,
    props: {
      columns: Array,
      border: [Number, Object],
      striped: { type: Boolean, default: undefined },
      style: null,
    } as never,
    slots: Object as SlotsType<{ default?: () => VNode[] }>,
  },
)

interface TableHeaderProps {
  /** Draw the header at the top of every page the table spans. `true` by default. */
  repeat?: boolean
  style?: PdfStyle
}

/** The header rows. Fixed, so it is drawn again at the top of each page the table continues on. */
export const TableHeader = defineComponent(
  (props: TableHeaderProps & { position?: Pick<RowPosition, 'first'> }, { attrs, slots }) =>
    () => {
      const first = props.position?.first ?? true
      const rows = flatten(slots.default?.()).map((node, index) =>
        node.type === TableRow ? cloneVNode(node, { position: { first: first && index === 0, shaded: false } }) : node,
      )
      return h(
        View,
        {
          ...attrs,
          style: merge({ backgroundColor: '#e5e7eb', fontWeight: 700 }, props.style),
          fixed: props.repeat !== false,
        },
        () => rows,
      )
    },
  {
    name: 'TableHeader',
    inheritAttrs: false,
    props: { repeat: { type: Boolean, default: true }, style: null, position: null } as never,
    slots: Object as SlotsType<{ default?: () => VNode[] }>,
  },
)

interface TableRowProps {
  /** Allow the row to split across pages. Rows stay whole by default. */
  wrap?: boolean
  style?: PdfStyle
}

export const TableRow = defineComponent(
  (props: TableRowProps & { position?: RowPosition }, { attrs, slots }) => {
    const table = inject(tableKey, null)
    return () => {
      const border = table?.().border
      const position = props.position ?? { first: true, shaded: false }
      const defaults: Style = { flexDirection: 'row' }
      if (border && !position.first) {
        defaults.borderTopWidth = border.width
        defaults.borderTopColor = border.color
        defaults.borderTopStyle = 'solid'
      }
      if (position.shaded) defaults.backgroundColor = STRIPE
      // A cell takes the next column after the previous one, or the one it names.
      let next = 0
      const cells = flatten(slots.default?.()).map((node) => {
        if (node.type !== TableCell) return node
        const column = (node.props?.column as number | undefined) ?? next
        next = column + 1
        return cloneVNode(node, { column })
      })
      return h(View, { ...attrs, style: merge(defaults, props.style), wrap: props.wrap === true }, () => cells)
    }
  },
  {
    name: 'TableRow',
    inheritAttrs: false,
    props: { wrap: { type: Boolean, default: false }, style: null, position: null } as never,
    slots: Object as SlotsType<{ default?: () => VNode[] }>,
  },
)

interface TableCellProps {
  /** Zero-based column. Cells take the next column in order unless this says otherwise. */
  column?: number
  align?: TableAlign
  style?: PdfStyle
}

export const TableCell = defineComponent(
  (props: TableCellProps, { attrs, slots }) => {
    const table = inject(tableKey, null)
    return () => {
      const { columns, border } = table?.() ?? { columns: [], border: null }
      const index = props.column ?? 0
      const defaults: Style = { ...columnStyle(columns[index]), padding: 4 }
      if (border && index > 0) {
        defaults.borderLeftWidth = border.width
        defaults.borderLeftColor = border.color
        defaults.borderLeftStyle = 'solid'
      }
      if (props.align) defaults.textAlign = props.align
      return h(View, { ...attrs, style: merge(defaults, props.style) }, () => withText(slots.default?.() ?? []))
    }
  },
  {
    name: 'TableCell',
    inheritAttrs: false,
    props: { column: Number, align: String, style: null } as never,
    slots: Object as SlotsType<{ default?: () => VNode[] }>,
  },
)
