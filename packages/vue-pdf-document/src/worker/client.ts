import type { Component } from 'vue'

import type { DocumentPropsOf, PropsOptional } from '../components/types'
import { PdfRenderError, type RenderOptions } from '../core/pdf'
import { toCloneable } from './clone'
import type { MessageEndpoint, WireError, WorkerRequest, WorkerResponse } from './protocol'

/** A `Worker`, or anything with the same messaging methods. */
export interface WorkerLike extends MessageEndpoint {
  terminate?: () => void
  close?: () => void
}

/** `render()`'s arguments after the name: props are required when the document requires some. */
export type WorkerRenderArgs<C> =
  PropsOptional<C> extends true
    ? [props?: DocumentPropsOf<C>, options?: RenderOptions]
    : [props: DocumentPropsOf<C>, options?: RenderOptions]

export interface PdfWorkerClient<D extends Record<string, Component> = Record<string, Component>> {
  /** Renders the document exposed as `name` in the worker. Rejects with `AbortError` when `signal` aborts. */
  render: <K extends keyof D & string>(name: K, ...args: WorkerRenderArgs<D[K]>) => Promise<Blob>
  /** Stops the worker and rejects the renders still pending. */
  terminate: () => void
}

/** Page counts of the blobs a client returned, for `useWorkerPdf`. */
export const pageCounts = new WeakMap<Blob, number | null>()

const abortError = (): DOMException => new DOMException('[vue-pdf-document] The render was aborted.', 'AbortError')

const rebuild = ({ name, message, phase }: WireError): Error => {
  if (name === 'AbortError') return new DOMException(message, 'AbortError')
  if (name === 'PdfRenderError' && phase) {
    const error = new PdfRenderError(phase, new Error(message))
    Object.defineProperty(error, 'message', { value: message })
    return error
  }
  const error = new Error(message)
  error.name = name
  return error
}

interface Pending {
  resolve: (blob: Blob) => void
  reject: (error: unknown) => void
  detach: () => void
}

/**
 * Wraps a worker that called `exposeDocuments`. Pass `typeof documents` from the worker
 * module as the type argument to check names and props.
 */
export function createPdfWorker<D extends Record<string, Component> = Record<string, Component>>(
  worker: WorkerLike,
): PdfWorkerClient<D> {
  const pending = new Map<number, Pending>()
  let next = 0
  let terminated = false

  const onMessage = (event: MessageEvent): void => {
    const message = event.data as WorkerResponse
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    entry.detach()
    if (message.type === 'error') {
      entry.reject(rebuild(message.error))
      return
    }
    const blob = new Blob([message.buffer], { type: 'application/pdf' })
    pageCounts.set(blob, message.pageCount)
    entry.resolve(blob)
  }
  worker.addEventListener('message', onMessage)
  worker.start?.()

  const post = (message: WorkerRequest): void => worker.postMessage(message, [])

  return {
    render(name, ...[props, options]: unknown[]) {
      const signal = (options as RenderOptions | undefined)?.signal
      if (terminated) return Promise.reject(new Error('[vue-pdf-document] The worker was terminated.'))
      if (signal?.aborted) return Promise.reject(abortError())
      let cloneable: unknown
      try {
        cloneable = toCloneable(props)
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
      const id = ++next
      return new Promise<Blob>((resolve, reject) => {
        const onAbort = (): void => {
          pending.delete(id)
          post({ id, type: 'abort' })
          reject(abortError())
        }
        signal?.addEventListener('abort', onAbort, { once: true })
        pending.set(id, { resolve, reject, detach: () => signal?.removeEventListener('abort', onAbort) })
        post({ id, type: 'render', name: name, props: cloneable })
      })
    },
    terminate() {
      if (terminated) return
      terminated = true
      worker.removeEventListener('message', onMessage)
      worker.terminate?.()
      worker.close?.()
      for (const entry of [...pending.values()]) {
        entry.detach()
        entry.reject(new Error('[vue-pdf-document] The worker was terminated.'))
      }
      pending.clear()
    },
  }
}
