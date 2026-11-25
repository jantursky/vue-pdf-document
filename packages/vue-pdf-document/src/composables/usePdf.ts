import {
  getCurrentInstance,
  type App,
  type ComponentInternalInstance,
  onMounted,
  type Component,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import type { DocumentPropsOf, PropsOptional } from '../components/types'
import type { Props } from '../core/nodes'
import { mountDocument, type PdfInstance } from '../core/pdf'
import { createScheduler } from './scheduler'

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

  let instance: PdfInstance | undefined
  let stop: (() => void) | undefined

  const { start, schedule, ...result } = createScheduler({
    debounce,
    enabled,
    render: async (signal) => {
      if (!instance) throw new Error('[vue-pdf-document] The document is not mounted.')
      const blob = await instance.toBlob({ signal })
      return { blob, pageCount: instance.pageCount }
    },
    onDispose: () => {
      stop?.()
      instance?.unmount()
    },
  })

  const mount = (): void => {
    instance = mountDocument(document, props, host ? { setup: (app) => inherit(app, host) } : {})
    stop = instance.onChange(schedule)
    start()
  }

  if (getCurrentInstance()) onMounted(mount)
  else mount()

  return result
}
