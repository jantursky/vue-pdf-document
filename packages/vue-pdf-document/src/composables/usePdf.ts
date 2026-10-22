import {
  getCurrentInstance,
  onMounted,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  type Component,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import type { Props } from '../core/nodes'
import { pdf, type PdfInstance } from '../core/pdf'

/** How long a replaced object URL stays valid, for downloads and frames still reading it. */
const REVOKE_DELAY = 10_000

export interface UsePdfOptions {
  /** Milliseconds to wait after the last change before rendering again. `100` by default. */
  debounce?: number
}

export interface UsePdfReturn {
  /** The latest rendered file, or `null` before the first render finishes. */
  blob: Readonly<Ref<Blob | null>>
  /** An object URL for `blob`. A replaced URL is revoked 10 s later, and the last one when the scope ends. */
  url: Readonly<Ref<string | null>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
  /** Renders again now, without waiting for a change. */
  update: () => Promise<void>
}

/**
 * Renders `document` to a Blob and keeps it current. Reactive state the document
 * reads, through `props` or directly, triggers a new render after `debounce` ms.
 * Call it inside a component's setup or an effect scope. In a component, the first
 * render waits for `onMounted`, so server-side rendering never touches the engine.
 */
export function usePdf(
  document: Component,
  props?: MaybeRefOrGetter<Props | undefined>,
  options: UsePdfOptions = {},
): UsePdfReturn {
  const { debounce = 100 } = options
  const blob = shallowRef<Blob | null>(null)
  const url = ref<string | null>(null)
  const loading = ref(true)
  const error = shallowRef<unknown>(null)

  let instance: PdfInstance | undefined
  let stop: (() => void) | undefined
  let disposed = false
  let run = 0
  let timer: ReturnType<typeof setTimeout> | undefined

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
    if (!instance) return
    clearTimeout(timer)
    const current = ++run
    loading.value = true
    try {
      const result = await instance.toBlob()
      // A newer render started meanwhile; its result wins.
      if (current !== run) return
      blob.value = result
      setUrl(URL.createObjectURL(result))
      error.value = null
    } catch (caught) {
      if (current === run) error.value = caught
    } finally {
      if (current === run) loading.value = false
    }
  }

  const start = (): void => {
    if (disposed) return
    instance = pdf(document, props)
    stop = instance.onChange(() => {
      clearTimeout(timer)
      timer = setTimeout(() => void update(), debounce)
    })
    void update()
  }

  if (getCurrentInstance()) onMounted(start)
  else start()

  onScopeDispose(() => {
    disposed = true
    run++
    clearTimeout(timer)
    stop?.()
    instance?.unmount()
    for (const [old, pending] of retiring) {
      clearTimeout(pending)
      URL.revokeObjectURL(old)
    }
    retiring.clear()
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = null
  })

  return { blob: readonly(blob), url: readonly(url), loading: readonly(loading), error: readonly(error), update }
}
