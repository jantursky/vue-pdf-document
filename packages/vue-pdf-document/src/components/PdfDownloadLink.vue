<script setup lang="ts">
import { ref, watch, type Component } from 'vue'

import { usePdf } from '../composables/usePdf'

const props = withDefaults(
  defineProps<{
    /** A component that renders a `<Document>`. Read once, at setup. */
    document: Component
    /** Props for `document`. Changes render the file again. */
    documentProps?: Record<string, unknown>
    /** File name offered by the browser. */
    fileName?: string
    /** While `false`, nothing renders. */
    enabled?: boolean
    /** Render only once the link is hovered, focused or clicked. */
    lazy?: boolean
  }>(),
  { fileName: 'document.pdf', enabled: true, lazy: false },
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
const { url, blob, pageCount, loading, error } = usePdf(props.document, () => props.documentProps, {
  enabled: () => props.enabled && activated.value,
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
