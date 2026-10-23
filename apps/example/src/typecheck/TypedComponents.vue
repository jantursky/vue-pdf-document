<!--
  Template type checks for the generic components: `document-props` is checked against
  the props of `document`. The valid bindings must compile, and `bun run typecheck` fails
  if an expected error goes missing. Not imported by the demo.
-->
<script setup lang="ts">
import { PdfDownloadLink, PdfViewer } from 'vue-pdf-document'

import InvoiceDocument from './getting-started/InvoiceDocument.vue'
</script>

<template>
  <PdfViewer :document="InvoiceDocument" :document-props="{ customer: 'Ada', total: 42 }" />
  <PdfDownloadLink :document="InvoiceDocument" :document-props="{ customer: 'Ada', total: 42 }" />

  <!-- @vue-expect-error total is a number -->
  <PdfViewer :document="InvoiceDocument" :document-props="{ customer: 'Ada', total: 'none' }" />
  <!-- @vue-expect-error custmer is not a prop of InvoiceDocument -->
  <PdfDownloadLink :document="InvoiceDocument" :document-props="{ custmer: 'Ada', total: 42 }" />
</template>
