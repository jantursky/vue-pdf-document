import {
  getCurrentInstance,
  type App,
  type ComponentInternalInstance,
  onMounted,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  toValue,
  watch,
  type Component,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import type { DocumentPropsOf, PropsOptional } from '../components/types'
import type { Props } from '../core/nodes'
import { isAbortError, mountDocument, type PdfInstance } from '../core/pdf'

/** How long a replaced object URL stays valid, for downloads and frames still reading it. */
const REVOKE_DELAY = 10_000

export interface UsePdfOptions {
  /** Milliseconds to wait after the last change before rendering again. `100` by default. */
  debounce?: number
  /** While `false`, nothing renders. Turning it `true` renders once. `true` by default. */
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * Let the document see what the calling component can inject, and the host app's global
   * components, directives, `globalProperties` and plugin state. `false` by default.
   */
  inheritContext?: boolean
}

export interface UsePdfReturn {
  /** The latest rendered file, or `null` before the first render finishes. */
  blob: Readonly<Ref<Blob | null>>
  /** An object URL for `blob`. A replaced URL is revoked 10 s later, and the last one when the scope ends. */
  url: Readonly<Ref<string | null>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
  /** Pages of the file in `blob`, or `null` before the first render finishes. */
  pageCount: Readonly<Ref<number | null>>
  /** Renders again now, without waiting for a change. Does nothing while disabled. */
  update: () => Promise<void>
}

/**
 * Points the document's app at the host component's context. Provides chain through the
 * component's own `provides`, which already lead to its ancestors and the host app, so
 * values provided later stay visible and reactive ones stay reactive.
 */
const inherit = (app: App, host: ComponentInternalInstance): void => {
  const target = app._context
  const source = host.appContext
  target.provides = Object.create((host as unknown as { provides: object }).provides) as typeof target.provides
  Object.assign(target.components, source.components)
  Object.assign(target.directives, source.directives)
  Object.assign(target.config.globalProperties, source.config.globalProperties)
  // Plugins such as vue-i18n keep their key on the app object itself.
  for (const key of Object.keys(source.app)) {
    if (!(key in app)) Reflect.set(app, key, Reflect.get(source.app, key))
  }
}

/**
 * Renders `document` to a Blob and keeps it current. Reactive state the document
 * reads, through `props` or directly, triggers a new render after `debounce` ms.
 * A render that a newer one overtakes is aborted.
 * Call it inside a component's setup or an effect scope. In a component, the first
 * render waits for `onMounted`, so server-side rendering never touches the engine.
 */
/** `usePdf()`'s arguments after the document: props are required when the document requires some. */
export type UsePdfArgs<C> =
  PropsOptional<C> extends true
    ? [props?: MaybeRefOrGetter<DocumentPropsOf<C> | undefined>, options?: UsePdfOptions]
    : [props: MaybeRefOrGetter<DocumentPropsOf<C>>, options?: UsePdfOptions]

export function usePdf<C extends Component>(document: C, ...args: UsePdfArgs<C>): UsePdfReturn {
  const props = args[0] as MaybeRefOrGetter<Props | undefined>
  const options: UsePdfOptions = args[1] ?? {}
  const { debounce = 100, enabled = true, inheritContext = false } = options
  const host = inheritContext ? getCurrentInstance() : null
  const isEnabled = (): boolean => toValue(enabled)
  const blob = shallowRef<Blob | null>(null)
  const url = ref<string | null>(null)
  const loading = ref(isEnabled())
  const error = shallowRef<unknown>(null)
  const pageCount = ref<number | null>(null)

  let instance: PdfInstance | undefined
  let stop: (() => void) | undefined
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
    if (!instance || !isEnabled()) return
    clearTimeout(timer)
    const current = ++run
    controller?.abort()
    const own = (controller = new AbortController())
    loading.value = true
    try {
      const result = await instance.toBlob({ signal: own.signal })
      // A newer render started meanwhile; its result wins.
      if (current !== run) return
      pageCount.value = instance.pageCount
      blob.value = result
      setUrl(URL.createObjectURL(result))
      error.value = null
    } catch (caught) {
      if (current === run && !isAbortError(caught)) error.value = caught
    } finally {
      if (current === run) loading.value = false
    }
  }

  const start = (): void => {
    if (disposed) return
    instance = mountDocument(document, props, host ? { setup: (app) => inherit(app, host) } : {})
    stop = instance.onChange(() => {
      clearTimeout(timer)
      if (isEnabled()) timer = setTimeout(() => void update(), debounce)
    })
    void update()
  }

  watch(isEnabled, (on) => {
    if (!instance) return
    if (on) {
      void update()
      return
    }
    cancel()
    loading.value = false
  })

  if (getCurrentInstance()) onMounted(start)
  else start()

  onScopeDispose(() => {
    disposed = true
    cancel()
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

  return {
    blob: readonly(blob),
    url: readonly(url),
    loading: readonly(loading),
    error: readonly(error),
    pageCount: readonly(pageCount),
    update,
  }
}
