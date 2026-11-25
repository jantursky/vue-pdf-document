<script setup lang="ts">
import { onScopeDispose, watch } from 'vue'
import { createPdfWorker, useWorkerPdf } from 'vue-pdf-document/worker'

import type { documents } from './report.worker'

const props = defineProps<{ sections: number }>()
const emit = defineEmits<{ rendered: [pageCount: number] }>()

const client = createPdfWorker<typeof documents>(
  new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' }),
)
onScopeDispose(() => client.terminate())

const { url, pageCount, error } = useWorkerPdf(client, 'report', () => ({ sections: props.sections }), {
  debounce: 250,
})
watch(pageCount, (count) => {
  if (count !== null) emit('rendered', count)
})
</script>

<template>
  <div class="viewer">
    <p v-if="error" class="note">Rendering failed: {{ error }}</p>
    <iframe v-if="url" data-pdf-viewer-frame title="Report, rendered in a worker" :src="url" />
  </div>
</template>
