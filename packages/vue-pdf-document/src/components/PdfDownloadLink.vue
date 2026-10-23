<script setup lang="ts" generic="C extends Component">
import { ref, watch, type Component } from 'vue'

import { usePdf } from '../composables/usePdf'
import type { DocumentPropsOf } from './types'

const props = withDefaults(
  defineProps<{
    /** A component that renders a `<Document>`. Read once, at setup. */
    document: C
    /** Props for `document`, checked against the props it declares. Changes render the file again. */
    documentProps?: DocumentPropsOf<C>
    /** File name offered by the browser. */
    fileName?: string
    /** While `false`, nothing renders. */
    enabled?: boolean
    /** Render only once the link is hovered, focused or clicked. */
    lazy?: boolean
    /** Let the document see what this component can inject, and the app's plugins. */
    inheritContext?: boolean
  }>(),
  { fileName: 'document.pdf', enabled: true, lazy: false, inheritContext: false },
)

const emit = defineEmits<{
  rendered: [result: { blob: Blob; url: string; pageCount: number }]
  error: [error: unknown]
}>()

defineSlots<{
  default?: (props: { loading: boolean; url: string | null; blob: Blob | null; error: unknown }) => unknown
}>()

const activated = ref(!props.lazy)
// A click that arrived before the file was ready, waiting to start the download. Until a
// lazy link has a file it has no `href`, so `role` and `tabindex` keep it reachable by keyboard.
const held = ref(false)

// The document is read once; `documentProps` stays reactive through the getter.
const { url, blob, pageCount, loading, error } = usePdf(props.document as Component, () => props.documentProps, {
  enabled: () => props.enabled && activated.value,
  inheritContext: props.inheritContext,
})

const activate = () => {
  activated.value = true
}

const onClick = (event: Event) => {
  activate()
  if (url.value) return
  event.preventDefault()
  if (props.enabled) held.value = true
}

watch(blob, (next) => {
  if (!next || !url.value) return
  emit('rendered', { blob: next, url: url.value, pageCount: pageCount.value ?? 0 })
  if (!held.value) return
  held.value = false
  const link = document.createElement('a')
  link.href = url.value
  link.download = props.fileName
  link.click()
})
watch(error, (next) => {
  if (next == null) return
  held.value = false
  emit('error', next)
})
</script>

<template>
  <a
    :href="url ?? undefined"
    :download="fileName"
    :aria-disabled="url || lazy ? undefined : 'true'"
    :aria-busy="held ? 'true' : undefined"
    :role="lazy && !url ? 'link' : undefined"
    :tabindex="lazy && !url ? 0 : undefined"
    data-pdf-download-link
    @pointerenter="activate"
    @focus="activate"
    @click="onClick"
    @keydown.enter="url ? undefined : onClick($event)"
  >
    <slot :loading="loading" :url="url" :blob="blob" :error="error">Download PDF</slot>
  </a>
</template>
