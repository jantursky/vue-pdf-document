<!--
  Generated from packages/vue-pdf-document/README.md by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { reactive } from 'vue'
import { PdfDownloadLink, PdfViewer } from 'vue-pdf-document'

import InvoiceDocument from './InvoiceDocument.vue'

const invoice = reactive({ customer: 'Ada', items: [{ name: 'Design review', price: 240 }] })
</script>

<template>
  <input v-model="invoice.customer" />
  <PdfViewer :document="InvoiceDocument" :document-props="invoice" style="height: 600px" />
  <PdfDownloadLink :document="InvoiceDocument" :document-props="invoice" file-name="invoice.pdf" />
</template>
