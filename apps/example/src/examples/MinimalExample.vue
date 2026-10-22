<script setup lang="ts">
import { ref } from 'vue'
import { PdfViewer } from 'vue-pdf-document'

import HelloDocument from './HelloDocument.vue'

const name = ref('Ada')
</script>

<template>
  <label class="field">
    Name
    <input v-model="name" />
  </label>
  <PdfViewer class="viewer" :document="HelloDocument" :document-props="{ name }">
    <template #loading><p class="note">Rendering…</p></template>
    <template #error="{ error }">
      <p class="note">Rendering failed: {{ error }}</p>
    </template>
  </PdfViewer>
</template>
