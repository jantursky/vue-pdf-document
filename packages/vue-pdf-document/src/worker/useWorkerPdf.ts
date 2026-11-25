import { getCurrentInstance, onMounted, toValue, watch, type Component, type MaybeRefOrGetter } from 'vue'

import type { DocumentPropsOf, PropsOptional } from '../components/types'
import { createScheduler } from '../composables/scheduler'
import type { UsePdfReturn } from '../composables/usePdf'
import { pageCounts, type PdfWorkerClient } from './client'

export interface UseWorkerPdfOptions {
  /** Milliseconds to wait after the last change before rendering again. `100` by default. */
  debounce?: number
  /** While `false`, nothing renders. Turning it `true` renders once. `true` by default. */
  enabled?: MaybeRefOrGetter<boolean>
}

/** `useWorkerPdf()`'s arguments after the name: props are required when the document requires some. */
export type UseWorkerPdfArgs<C> =
  PropsOptional<C> extends true
    ? [props?: MaybeRefOrGetter<DocumentPropsOf<C> | undefined>, options?: UseWorkerPdfOptions]
    : [props: MaybeRefOrGetter<DocumentPropsOf<C>>, options?: UseWorkerPdfOptions]

/**
 * Like `usePdf`, but the document renders in a worker. Props are watched deeply and sent as
 * structured clones, so they must be plain data. Call it inside a component's setup or an
 * effect scope. In a component the first render waits for `onMounted`.
 */
export function useWorkerPdf<D extends Record<string, Component>, K extends keyof D & string>(
  client: PdfWorkerClient<D>,
  name: K,
  ...args: UseWorkerPdfArgs<D[K]>
): UsePdfReturn {
  const props = args[0] as MaybeRefOrGetter<Record<string, unknown> | undefined>
  const { debounce = 100, enabled = true } = args[1] ?? {}
  const render = client.render as (name: string, props: unknown, options: { signal: AbortSignal }) => Promise<Blob>

  const { start, schedule, ...result } = createScheduler({
    debounce,
    enabled,
    render: async (signal) => {
      const blob = await render(name, toValue(props), { signal })
      return { blob, pageCount: pageCounts.get(blob) ?? null }
    },
  })

  // There is no document tree on this thread to report changes, so the props are the source.
  watch(() => toValue(props), schedule, { deep: true })

  if (getCurrentInstance()) onMounted(start)
  else start()

  return result
}
