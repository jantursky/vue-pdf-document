<script setup lang="ts">
import { ref } from 'vue'
import { PdfViewer } from 'vue-pdf-document'

import ReportDocument from './ReportDocument.vue'

const sections = ref(12)
</script>

<template>
  <label class="field">
    Sections: {{ sections }}
    <input v-model.number="sections" type="range" min="1" max="60" />
  </label>
  <PdfViewer class="viewer" :document="ReportDocument" :document-props="{ sections }" :debounce="250">
    <template #error="{ error }">
      <p class="note">Rendering failed: {{ error }}</p>
    </template>
  </PdfViewer>
</template>
