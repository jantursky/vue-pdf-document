import type { App, Component } from 'vue'

import { isAbortError, mountDocument, PdfRenderError } from '../core/pdf'
import type { MessageEndpoint, WireError, WorkerRequest, WorkerResponse } from './protocol'

export interface ExposeOptions {
  /** Applied to every document app before it mounts, to install plugins or provide values. */
  setup?: (app: App) => void
  /** Where to listen. The worker's global scope by default; a `MessagePort` works too. */
  port?: MessageEndpoint
}

// A function, so the check isn't narrowed away: the signal can abort during the awaits.
const isAborted = (controller: AbortController): boolean => controller.signal.aborted

const toWireError = (error: unknown): WireError => {
  if (error instanceof PdfRenderError) {
    const hint = /font/i.test(error.message)
      ? ' Fonts and images registered on the main thread are not visible in a worker; call Font.register in the worker module.'
      : ''
    return { name: error.name, message: error.message + hint, phase: error.phase }
  }
  if (isAbortError(error)) return { name: 'AbortError', message: (error as Error).message }
  const { name, message } = error instanceof Error ? error : new Error(String(error))
  return { name, message }
}

/**
 * Call it in a worker module to answer render requests from `createPdfWorker`. Documents are
 * looked up by the name they are registered under. Requests run one at a time.
 * Returns `documents`, so `typeof documents` can type the client.
 */
export function exposeDocuments<D extends Record<string, Component>>(documents: D, options: ExposeOptions = {}): D {
  const port = options.port ?? (globalThis as unknown as MessageEndpoint)
  const controllers = new Map<number, AbortController>()
  let queue: Promise<void> = Promise.resolve()

  const reply = (message: WorkerResponse, transfer: Transferable[] = []): void => port.postMessage(message, transfer)

  const render = async (id: number, name: string, props: unknown, controller: AbortController): Promise<void> => {
    if (controller.signal.aborted) return
    const document = Object.hasOwn(documents, name) ? documents[name] : undefined
    if (!document) {
      const known = Object.keys(documents).join(', ')
      throw new Error(`[vue-pdf-document] No document named "${name}" is exposed. Exposed: ${known}.`)
    }
    const instance = mountDocument(document, props as Record<string, unknown> | undefined, {
      setup: options.setup,
    })
    try {
      const bytes = await instance.toBuffer({ signal: controller.signal })
      const buffer =
        bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
          ? (bytes.buffer as ArrayBuffer)
          : bytes.slice().buffer
      if (!isAborted(controller)) reply({ id, type: 'done', buffer, pageCount: instance.pageCount }, [buffer])
    } finally {
      instance.unmount()
    }
  }

  port.addEventListener('message', (event) => {
    const request = event.data as WorkerRequest
    if (request.type === 'abort') {
      controllers.get(request.id)?.abort()
      return
    }
    const controller = new AbortController()
    controllers.set(request.id, controller)
    queue = queue
      .then(() => render(request.id, request.name, request.props, controller))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) reply({ id: request.id, type: 'error', error: toWireError(error) })
      })
      .finally(() => controllers.delete(request.id))
  })
  port.start?.()
  return documents
}
