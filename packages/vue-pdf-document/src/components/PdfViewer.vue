<script setup lang="ts" generic="C extends Component">
import { computed, watch, type Component } from 'vue'

import { usePdf } from '../composables/usePdf'
import type { DocumentPropsOf } from './types'

const props = withDefaults(
  defineProps<{
    /** A component that renders a `<Document>`. Read once, at setup. */
    document: C
    /** Props for `document`, checked against the props it declares. Changes render the file again. */
    documentProps?: DocumentPropsOf<C>
    /** Accessible name of the frame. */
    title?: string
    debounce?: number
    /** While `false`, nothing renders. */
    enabled?: boolean
    /** Page the browser's viewer opens at. */
    page?: number
    /** Zoom in percent, or a fit mode. Browsers that don't support one ignore it. */
    zoom?: number | 'page-fit' | 'page-width'
    /** Show or hide the browser's viewer toolbar. Browsers that don't support it ignore it. */
    toolbar?: boolean
    /** Let the document see what this component can inject, and the app's plugins. */
    inheritContext?: boolean
  }>(),
  { title: 'PDF preview', debounce: 100, enabled: true, toolbar: undefined, inheritContext: false },
)

const emit = defineEmits<{
  rendered: [result: { blob: Blob; url: string; pageCount: number }]
  error: [error: unknown]
}>()

defineSlots<{
  /** Shown until the first render finishes. */
  loading?: () => unknown
  error?: (props: { error: unknown }) => unknown
}>()

// The document is read once; `documentProps` stays reactive through the getter.
const { url, blob, pageCount, loading, error } = usePdf(props.document as Component, () => props.documentProps, {
  debounce: props.debounce,
  enabled: () => props.enabled,
  inheritContext: props.inheritContext,
})

watch(blob, (next) => {
  if (next && url.value) emit('rendered', { blob: next, url: url.value, pageCount: pageCount.value ?? 0 })
})
watch(error, (next) => {
  if (next != null) emit('error', next)
})

// PDF open parameters, read from the fragment by the browsers' built-in viewers.
const src = computed(() => {
  if (!url.value) return undefined
  const params: string[] = []
  if (props.page !== undefined) params.push(`page=${props.page}`)
  if (props.zoom !== undefined) params.push(`zoom=${props.zoom}`)
  if (props.toolbar !== undefined) params.push(`toolbar=${props.toolbar ? 1 : 0}`)
  return params.length > 0 ? `${url.value}#${params.join('&')}` : url.value
})
</script>

<template>
  <div data-pdf-viewer :data-loading="loading || undefined">
    <slot v-if="error" name="error" :error="error" />
    <iframe v-else-if="src" :src="src" :title="title" data-pdf-viewer-frame />
    <slot v-else name="loading" />
  </div>
</template>
