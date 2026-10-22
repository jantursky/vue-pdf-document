<!--
  Generated from apps/docs/docs/getting-started.mdx by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { PdfViewer, PdfDownloadLink } from 'vue-pdf-document'

import InvoiceDocument from './InvoiceDocument.vue'

const customer = ref('Ada')
</script>

<template>
  <input v-model="customer" />
  <PdfViewer :document="InvoiceDocument" :document-props="{ customer, total: 42 }" style="height: 600px" />
  <PdfDownloadLink :document="InvoiceDocument" :document-props="{ customer, total: 42 }" file-name="invoice.pdf" />
</template>
