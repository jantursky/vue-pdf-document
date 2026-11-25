<script setup lang="ts">
import { ref } from 'vue'
import { PdfViewer } from 'vue-pdf-document'

import ReportDocument from './ReportDocument.vue'
import ReportWorkerViewer from './ReportWorkerViewer.vue'

const sections = ref(12)
const pages = ref<number | null>(null)
const inWorker = ref(false)
</script>

<template>
  <label class="field">
    Sections: {{ sections }}
    <input v-model.number="sections" type="range" min="1" max="60" />
  </label>
  <label class="check"><input v-model="inWorker" type="checkbox" /> Render in a worker</label>
  <p class="note" data-page-count>{{ pages === null ? 'Rendering…' : `${pages} pages` }}</p>
  <ReportWorkerViewer v-if="inWorker" :sections="sections" @rendered="(count) => (pages = count)" />
  <PdfViewer
    v-else
    class="viewer"
    :document="ReportDocument"
    :document-props="{ sections }"
    :debounce="250"
    @rendered="({ pageCount }) => (pages = pageCount)"
  >
    <template #error="{ error }">
      <p class="note">Rendering failed: {{ error }}</p>
    </template>
  </PdfViewer>
</template>
