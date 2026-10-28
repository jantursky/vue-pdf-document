import { inflateSync } from 'node:zlib'

import FontStore from '@react-pdf/font'
import layoutDocument from '@react-pdf/layout'
import { defineComponent, h, type Component, type VNodeChild } from 'vue'

import { Document, Page } from '../src'
import { createRoot } from '../src/core/nodes'
import { renderer } from '../src/core/renderer'
import { snapshot, type LayoutNode } from '../src/core/snapshot'

/** A document whose single page renders `children`. */
export const singlePage = (children: () => VNodeChild) =>
  defineComponent(() => () => h(Document, null, () => h(Page, null, children)))

/** Page count from the uncompressed page tree. Content streams are compressed, the tree isn't. */
export const pageCount = (bytes: Uint8Array): number => {
  const match = /\/Type \/Pages\s*\/Count (\d+)/.exec(new TextDecoder('latin1').decode(bytes))
  return match ? Number(match[1]) : 0
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * The text drawn with the standard fonts, one string per `TJ` operator. pdfkit writes
 * those as hex WinAnsi codes inside Flate-compressed content streams.
 */
export const pdfText = (bytes: Uint8Array): string[] => {
  const raw = Buffer.from(bytes).toString('latin1')
  const result: string[] = []
  for (const [, body] of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string
    try {
      content = inflateSync(Buffer.from(body!, 'latin1')).toString('latin1')
    } catch {
      continue
    }
    for (const [, array] of content.matchAll(/\[([^\]]*)\] TJ/g)) {
      const hex = [...array!.matchAll(/<([0-9a-f]*)>/gi)].map(([, part]) => part).join('')
      result.push(Buffer.from(hex, 'hex').toString('latin1'))
    }
  }
  return result
}

/** A string from the document info dictionary, such as `Title`. pdfkit stores each as its own object. */
export const pdfInfo = (bytes: Uint8Array, key: string): string | undefined => {
  const raw = Buffer.from(bytes).toString('latin1')
  const ref = new RegExp(`/${key} (\\d+) 0 R`).exec(raw)?.[1]
  if (!ref) return undefined
  return new RegExp(`\\n${ref} 0 obj\\n\\((.*)\\)\\nendobj`).exec(raw)?.[1]
}

// Layout's declarations show one parameter; at runtime every step also receives the font store.
const layout = layoutDocument as unknown as (doc: LayoutNode, fonts: FontStore) => Promise<unknown>

export interface Box {
  type: string
  text?: string
  page: number
  x: number
  y: number
  width: number
  height: number
  fill?: string
  align?: string
}

interface Laid {
  type: string
  box?: { top: number; left: number; width: number; height: number }
  style?: { backgroundColor?: string; textAlign?: string }
  lines?: { string?: string }[]
  children?: Laid[]
}

/** Lays `document` out with the real engine and lists every box with its page, for position checks. */
export const layoutBoxes = async (document: Component): Promise<Box[]> => {
  const root = createRoot()
  const app = renderer.createApp({ render: () => h(document) })
  app.mount(root)
  const laidOut = (await layout(snapshot(root, app._context), new FontStore())) as Laid
  const boxes: Box[] = []
  // Boxes are relative to their parent, so the offsets add up.
  const visit = (node: Laid, page: number, left = 0, top = 0) => {
    if (node.box) {
      boxes.push({
        type: node.type,
        text: node.lines?.map((line) => line.string).join(''),
        page,
        x: left + node.box.left,
        y: top + node.box.top,
        width: node.box.width,
        height: node.box.height,
        fill: node.style?.backgroundColor,
        align: node.style?.textAlign,
      })
    }
    for (const child of node.children ?? [])
      visit(child, page, left + (node.box?.left ?? 0), top + (node.box?.top ?? 0))
  }
  laidOut.children?.forEach((pageNode, index) => visit(pageNode, index + 1))
  return boxes
}
