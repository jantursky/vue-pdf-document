import type { RenderPhase } from '../core/pdf'

/** An error as it crosses the thread boundary. */
export interface WireError {
  name: string
  message: string
  phase?: RenderPhase
}

export type WorkerRequest = { id: number; type: 'render'; name: string; props: unknown } | { id: number; type: 'abort' }

export type WorkerResponse =
  | { id: number; type: 'done'; buffer: ArrayBuffer; pageCount: number | null }
  | { id: number; type: 'error'; error: WireError }

/** What both sides need from a `Worker`, a `MessagePort` or a worker's global scope. */
export interface MessageEndpoint {
  // `any` so a real `Worker`, `MessagePort` and worker global scope all fit.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postMessage: (message: any, transfer: Transferable[]) => void
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
  start?: () => void
}
