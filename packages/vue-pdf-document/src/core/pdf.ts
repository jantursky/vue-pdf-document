// Apps that type-check this source through a `paths` alias don't include the shim on their own.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../shims.d.ts" />
import { upperFirst } from '@react-pdf/fns'
import FontStore from '@react-pdf/font'
import layoutDocument from '@react-pdf/layout'
import renderPDF from '@react-pdf/render'
import PDFDocument from 'pdfkit'
import { h, toValue, type Component, type MaybeRefOrGetter } from 'vue'

import type { RenderInfo, Style } from '../components/types'
import { createRoot, type PdfRoot, type Props } from './nodes'
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

export interface RenderOptions {
  /** Aborts the render. The call then rejects with a `DOMException` named `AbortError`. */
  signal?: AbortSignal
}

/** The step a render failed in: building the layout input, laying it out, or writing the PDF. */
export type RenderPhase = 'snapshot' | 'layout' | 'render'

const PREFIX = '[vue-pdf-document] '

/** A failed render. `phase` says which step failed and `cause` holds the original error. */
export class PdfRenderError extends Error {
  readonly phase: RenderPhase

  constructor(phase: RenderPhase, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(message.startsWith(PREFIX) ? message : PREFIX + message, { cause })
    this.name = 'PdfRenderError'
    this.phase = phase
  }
}

export interface PdfInstance {
  /** Lays out and renders the current tree. */
  toBlob: (options?: RenderOptions) => Promise<Blob>
  toBuffer: (options?: RenderOptions) => Promise<Uint8Array>
  /** Renders the current tree as a stream of PDF chunks. Cancelling the stream aborts the render. */
  toStream: (options?: RenderOptions) => ReadableStream<Uint8Array>
  /** Pages of the last finished render, or `null` before the first one. */
  readonly pageCount: number | null
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

const createContext = (props: Props): PDFDocument => {
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
  return ctx
}

// Checked by name: DOM shims (happy-dom, jsdom) bring their own `DOMException` class.
export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'

const abortError = (signal: AbortSignal): DOMException =>
  isAbortError(signal.reason)
    ? (signal.reason as DOMException)
    : new DOMException('[vue-pdf-document] The render was aborted.', 'AbortError')

const checkpoint = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) throw abortError(signal)
}

const wrap =
  (phase: RenderPhase) =>
  (error: unknown): never => {
    throw isAbortError(error) || error instanceof PdfRenderError ? error : new PdfRenderError(phase, error)
  }

/** Settles with `promise`, or rejects as soon as `signal` aborts. Layout itself can't be interrupted. */
const untilAborted = <T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> => {
  if (!signal) return promise
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

const writePdf = (doc: LayoutNode, laidOut: LayoutNode, onChunk: (chunk: Uint8Array) => void, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    let settled = false
    const settle = (error?: unknown) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      if (error === undefined) resolve()
      // Engine errors pass through as they are; `run` wraps them.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      else reject(error)
    }
    const onAbort = () => {
      if (signal) settle(abortError(signal))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const stream = render(createContext(doc.props ?? {}), laidOut)
      stream.on('data', (chunk: Uint8Array) => {
        if (!settled) onChunk(chunk)
      })
      stream.on('end', () => settle())
      stream.on('error', (error: unknown) => settle(error))
    } catch (error) {
      settle(error)
    }
  })

/** Snapshots, lays out and writes `root`, checking `signal` between the steps. Resolves to the page count. */
const run = async (root: PdfRoot, onChunk: (chunk: Uint8Array) => void, signal?: AbortSignal): Promise<number> => {
  checkpoint(signal)
  let doc: LayoutNode
  try {
    doc = snapshot(root)
  } catch (error) {
    return wrap('snapshot')(error)
  }
  checkpoint(signal)
  const laidOut = await untilAborted(layout(doc, fontStore()), signal).catch(wrap('layout'))
  checkpoint(signal)
  await writePdf(doc, laidOut, onChunk, signal).catch(wrap('render'))
  return laidOut.children?.length ?? 0
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
  let pageCount: number | null = null

  const renderRoot = async (onChunk: (chunk: Uint8Array) => void, signal?: AbortSignal): Promise<number> => {
    if (!mounted) throw new PdfRenderError('snapshot', new Error('This document was unmounted.'))
    pageCount = await run(root, onChunk, signal)
    return pageCount
  }

  const toChunks = async (signal?: AbortSignal): Promise<[chunks: Uint8Array[], pages: number]> => {
    const chunks: Uint8Array[] = []
    const pages = await renderRoot((chunk) => chunks.push(chunk), signal)
    return [chunks, pages]
  }

  return {
    async toBlob({ signal } = {}) {
      const [chunks, pages] = await toChunks(signal)
      const blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' })
      const onRender = root.children[0]?.kind === 'element' ? root.children[0].props.onRender : undefined
      if (typeof onRender === 'function') (onRender as (info: RenderInfo) => void)({ blob, pageCount: pages })
      return blob
    },
    async toBuffer({ signal } = {}) {
      return concat((await toChunks(signal))[0])
    },
    toStream({ signal } = {}) {
      const controller = new AbortController()
      const abort = () => controller.abort(signal?.reason)
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
      let cancelled = false
      return new ReadableStream<Uint8Array>({
        start(stream) {
          renderRoot((chunk) => stream.enqueue(chunk), controller.signal)
            .then(
              () => {
                if (!cancelled) stream.close()
              },
              (error: unknown) => {
                if (!cancelled) stream.error(error)
              },
            )
            .finally(() => signal?.removeEventListener('abort', abort))
        },
        cancel() {
          cancelled = true
          controller.abort()
        },
      })
    },
    get pageCount() {
      return pageCount
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

const once = async <T>(document: Component, props: Props | undefined, use: (instance: PdfInstance) => Promise<T>) => {
  const instance = pdf(document, props)
  try {
    return await use(instance)
  } finally {
    instance.unmount()
  }
}

/** Renders `document` once to PDF bytes. Works in Node, workers and the browser. */
export const renderToBuffer = (document: Component, props?: Props, options?: RenderOptions): Promise<Uint8Array> =>
  once(document, props, (instance) => instance.toBuffer(options))

/** Renders `document` once to a PDF `Blob`. */
export const renderToBlob = (document: Component, props?: Props, options?: RenderOptions): Promise<Blob> =>
  once(document, props, (instance) => instance.toBlob(options))

/**
 * Renders `document` once as a stream of PDF chunks. The document is unmounted when the
 * stream closes, fails or is cancelled. Convert it for Node with `Readable.fromWeb()`.
 */
export const renderToStream = (
  document: Component,
  props?: Props,
  options?: RenderOptions,
): ReadableStream<Uint8Array> => {
  const instance = pdf(document, props)
  const reader = instance.toStream(options).getReader()
  return new ReadableStream<Uint8Array>({
    async pull(stream) {
      try {
        const { done, value } = await reader.read()
        if (!done) {
          stream.enqueue(value)
          return
        }
        instance.unmount()
        stream.close()
      } catch (error) {
        instance.unmount()
        stream.error(error)
      }
    },
    async cancel(reason) {
      await reader.cancel(reason)
      instance.unmount()
    },
  })
}
