import { onScopeDispose, readonly, ref, shallowRef, watch, type MaybeRefOrGetter, toValue } from 'vue'

import { isAbortError } from '../core/pdf'
import type { UsePdfReturn } from './usePdf'

/** How long a replaced object URL stays valid, for downloads and frames still reading it. */
const REVOKE_DELAY = 10_000

export interface RenderResult {
  blob: Blob
  pageCount: number | null
}

export interface SchedulerOptions {
  debounce: number
  enabled: MaybeRefOrGetter<boolean>
  /** Renders once. It should reject with an `AbortError` when `signal` aborts. */
  render: (signal: AbortSignal) => Promise<RenderResult>
  /** Runs when the scope ends, after pending work is cancelled. */
  onDispose?: () => void
}

export interface Scheduler extends UsePdfReturn {
  /** Allows rendering and renders once. Until then `update` and `schedule` do nothing. */
  start: () => void
  /** Renders after the debounce. */
  schedule: () => void
}

/**
 * The shared part of `usePdf` and `useWorkerPdf`: debounce, `enabled`, newest-wins with
 * abort, and the lifetime of the object URLs. Call it inside a component or effect scope.
 */
export const createScheduler = ({ debounce, enabled, render, onDispose }: SchedulerOptions): Scheduler => {
  const isEnabled = (): boolean => toValue(enabled)
  const blob = shallowRef<Blob | null>(null)
  const url = ref<string | null>(null)
  const loading = ref(isEnabled())
  const error = shallowRef<unknown>(null)
  const pageCount = ref<number | null>(null)

  let started = false
  let disposed = false
  let run = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  /** Drops the pending and the running render. */
  const cancel = (): void => {
    run++
    clearTimeout(timer)
    controller?.abort()
  }

  // A replaced URL may still be loading in a frame or downloading from a link, so it is
  // revoked a little later. Everything left is revoked when the scope ends.
  const retiring = new Map<string, ReturnType<typeof setTimeout>>()
  const retire = (old: string): void => {
    retiring.set(
      old,
      setTimeout(() => {
        retiring.delete(old)
        URL.revokeObjectURL(old)
      }, REVOKE_DELAY),
    )
  }
  const setUrl = (next: string | null): void => {
    if (url.value) retire(url.value)
    url.value = next
  }

  const update = async (): Promise<void> => {
    if (!started || !isEnabled()) return
    clearTimeout(timer)
    const current = ++run
    controller?.abort()
    const own = (controller = new AbortController())
    loading.value = true
    try {
      const result = await render(own.signal)
      // A newer render started meanwhile; its result wins.
      if (current !== run) return
      pageCount.value = result.pageCount
      blob.value = result.blob
      setUrl(URL.createObjectURL(result.blob))
      error.value = null
    } catch (caught) {
      if (current === run && !isAbortError(caught)) error.value = caught
    } finally {
      if (current === run) loading.value = false
    }
  }

  const schedule = (): void => {
    clearTimeout(timer)
    if (started && isEnabled()) timer = setTimeout(() => void update(), debounce)
  }

  const start = (): void => {
    if (disposed) return
    started = true
    void update()
  }

  watch(isEnabled, (on) => {
    if (!started) return
    if (on) {
      void update()
      return
    }
    cancel()
    loading.value = false
  })

  onScopeDispose(() => {
    disposed = true
    cancel()
    onDispose?.()
    for (const [old, pending] of retiring) {
      clearTimeout(pending)
      URL.revokeObjectURL(old)
    }
    retiring.clear()
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = null
  })

  return {
    blob: readonly(blob),
    url: readonly(url),
    loading: readonly(loading),
    error: readonly(error),
    pageCount: readonly(pageCount),
    update,
    start,
    schedule,
  }
}
