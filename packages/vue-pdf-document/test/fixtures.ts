import { inflateSync } from 'node:zlib'

import { defineComponent, h, type VNodeChild } from 'vue'

import { Document, Page } from '../src'

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
