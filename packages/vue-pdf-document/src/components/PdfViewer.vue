<script setup lang="ts">
import type { Component } from 'vue'

import { usePdf } from '../composables/usePdf'

const props = withDefaults(
  defineProps<{
    /** A component that renders a `<Document>`. Read once, at setup. */
    document: Component
    /** Props for `document`. Changes render the file again. */
    documentProps?: Record<string, unknown>
    /** Accessible name of the frame. */
    title?: string
    debounce?: number
  }>(),
  { title: 'PDF preview', debounce: 100 },
)

defineSlots<{
  /** Shown until the first render finishes. */
  loading?: () => unknown
  error?: (props: { error: unknown }) => unknown
}>()

// The document is read once; `documentProps` stays reactive through the getter.
const { url, loading, error } = usePdf(props.document, () => props.documentProps, { debounce: props.debounce })
</script>

<template>
  <div data-pdf-viewer :data-loading="loading || undefined">
    <slot v-if="error" name="error" :error="error" />
    <iframe v-else-if="url" :src="url" :title="title" data-pdf-viewer-frame />
    <slot v-else name="loading" />
  </div>
</template>
