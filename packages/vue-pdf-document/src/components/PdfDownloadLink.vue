<script setup lang="ts">
import type { Component } from 'vue'

import { usePdf } from '../composables/usePdf'

const props = withDefaults(
  defineProps<{
    /** A component that renders a `<Document>`. Read once, at setup. */
    document: Component
    /** Props for `document`. Changes render the file again. */
    documentProps?: Record<string, unknown>
    /** File name offered by the browser. */
    fileName?: string
  }>(),
  { fileName: 'document.pdf' },
)

defineSlots<{
  default?: (props: { loading: boolean; url: string | null; blob: Blob | null; error: unknown }) => unknown
}>()

// The document is read once; `documentProps` stays reactive through the getter.
const { url, blob, loading, error } = usePdf(props.document, () => props.documentProps)
</script>

<template>
  <a :href="url ?? undefined" :download="fileName" :aria-disabled="url ? undefined : 'true'" data-pdf-download-link>
    <slot :loading="loading" :url="url" :blob="blob" :error="error">Download PDF</slot>
  </a>
</template>
