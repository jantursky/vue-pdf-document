// Apps that type-check this source through a `paths` alias don't include the shim on their own.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../shims.d.ts" />
import { upperFirst } from '@react-pdf/fns'
import FontStore from '@react-pdf/font'
import layoutDocument from '@react-pdf/layout'
import renderPDF from '@react-pdf/render'
import PDFDocument from 'pdfkit'
import { h, toValue, type Component, type MaybeRefOrGetter } from 'vue'

import type { Style } from '../components/types'
import { createRoot, type Props } from './nodes'
import { renderer } from './renderer'
import { snapshot, type LayoutNode } from './snapshot'

let store: FontStore | undefined
// The store opens the standard fonts through pdfkit as soon as it's built, so it's built
// on first use. Importing the package then stays free of side effects, which keeps
// server-side bundles that inline pdfkit (and break its lazy font requires) working.
const fontStore = (): FontStore => (store ??= new FontStore())

/** Registers fonts, emoji sources and hyphenation for every document. Same API as react-pdf's `Font`. */
export const Font: FontStore = new Proxy({} as FontStore, {
  get(_, key) {
    const target = fontStore()
    const value: unknown = Reflect.get(target, key, target)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
  },
})

/** An identity helper, kept for parity with react-pdf so style objects can be shared. */
export const StyleSheet = {
  create: <T extends Record<string, Style>>(styles: T): T => styles,
}

export interface PdfInstance {
  /** Lays out and renders the current tree. */
  toBlob: () => Promise<Blob>
  toBuffer: () => Promise<Uint8Array>
  /** Calls `listener` after Vue patches the tree, for example when a prop it reads changes. */
  onChange: (listener: () => void) => () => void
  /** Unmounts the Vue app behind the document. The instance can't render afterwards. */
  unmount: () => void
}

const omitUndefined = (object: Props): Props =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))

// Layout's declarations show one parameter; at runtime every step also receives the font store.
const layout = layoutDocument as unknown as (doc: LayoutNode, fonts: FontStore) => Promise<LayoutNode>
const render = renderPDF as unknown as (ctx: PDFDocument, doc: LayoutNode) => PDFDocument

const renderToChunks = async (doc: LayoutNode): Promise<Uint8Array[]> => {
  const props = doc.props ?? {}
  const conformance = props.conformance as string | undefined
  const ctx = new PDFDocument({
    compress: true,
    subset: conformance,
    // PDF/A-1 needs PDF 1.4 and PDF/A-2/3 need 1.7; pdfkit's default 1.3 skips the PDF/A metadata.
    pdfVersion: props.pdfVersion ?? (conformance ? (conformance.startsWith('PDF/A-1') ? '1.4' : '1.7') : undefined),
    lang: props.language,
    displayTitle: true,
    autoFirstPage: false,
    ownerPassword: props.ownerPassword,
    userPassword: props.userPassword,
    permissions: props.permissions,
    pageLayout: props.pageLayout,
    info: omitUndefined({
      Title: props.title,
      Author: props.author,
      Subject: props.subject,
      Keywords: props.keywords,
      Creator: props.creator ?? 'vue-pdf-document',
      Producer: props.producer ?? 'vue-pdf-document',
      CreationDate: props.creationDate ?? new Date(),
      ModificationDate: props.modificationDate,
    }),
  })
  if (typeof props.pageMode === 'string') ctx._root.data.PageMode = upperFirst(props.pageMode)

  const laidOut = await layout(doc, fontStore())
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    const stream = render(ctx, laidOut)
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => {
      resolve(chunks)
    })
    stream.on('error', reject)
  })
}

const concat = (chunks: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

/**
 * Mounts `document` with the PDF renderer and returns a handle to render it. The
 * component must render a `<Document>`. Props are read through `toValue`, so a ref or
 * getter keeps the tree in sync with the data and `onChange` fires when it moves.
 */
export const pdf = (document: Component, props?: MaybeRefOrGetter<Props | undefined>): PdfInstance => {
  const root = createRoot()
  const listeners = new Set<() => void>()
  root.onChange = () => {
    for (const listener of [...listeners]) listener()
  }
  const app = renderer.createApp({ render: () => h(document, toValue(props)) })
  app.mount(root)
  let mounted = true

  const toChunks = (): Promise<Uint8Array[]> => {
    if (!mounted) return Promise.reject(new Error('[vue-pdf-document] This document was unmounted.'))
    return renderToChunks(snapshot(root))
  }

  return {
    async toBlob() {
      const blob = new Blob((await toChunks()) as BlobPart[], { type: 'application/pdf' })
      const onRender = root.children[0]?.kind === 'element' ? root.children[0].props.onRender : undefined
      if (typeof onRender === 'function') (onRender as (args: { blob: Blob }) => void)({ blob })
      return blob
    },
    async toBuffer() {
      return concat(await toChunks())
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    unmount() {
      if (!mounted) return
      mounted = false
      listeners.clear()
      root.onChange = null
      app.unmount()
    },
  }
}

const once = async <T>(document: Component, props: Props | undefined, run: (instance: PdfInstance) => Promise<T>) => {
  const instance = pdf(document, props)
  try {
    return await run(instance)
  } finally {
    instance.unmount()
  }
}

/** Renders `document` once to PDF bytes. Works in Node, workers and the browser. */
export const renderToBuffer = (document: Component, props?: Props): Promise<Uint8Array> =>
  once(document, props, (instance) => instance.toBuffer())

/** Renders `document` once to a PDF `Blob`. */
export const renderToBlob = (document: Component, props?: Props): Promise<Blob> =>
  once(document, props, (instance) => instance.toBlob())
