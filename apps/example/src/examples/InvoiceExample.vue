<script setup lang="ts">
import { reactive, ref } from 'vue'
import { PdfDownloadLink, PdfViewer } from 'vue-pdf-document'

import type { InvoiceItem } from './invoice'
import InvoiceDocument from './InvoiceDocument.vue'

let nextId = 3
const invoice = reactive({
  number: '2026-042',
  customer: 'Grace Hopper',
  paid: false,
  items: [
    { id: 1, name: 'Design review', quantity: 2, price: 120 },
    { id: 2, name: 'Implementation', quantity: 10, price: 95 },
  ] as InvoiceItem[],
})
const draft = ref('')

const add = () => {
  if (!draft.value.trim()) return
  invoice.items.push({ id: nextId++, name: draft.value.trim(), quantity: 1, price: 50 })
  draft.value = ''
}
</script>

<template>
  <div class="split">
    <form class="form" @submit.prevent="add">
      <label class="field">Customer <input v-model="invoice.customer" /></label>
      <label class="field">Number <input v-model="invoice.number" /></label>
      <label class="check"><input v-model="invoice.paid" type="checkbox" /> Paid</label>
      <ul class="items">
        <li v-for="item in invoice.items" :key="item.id">
          <span>{{ item.name }}</span>
          <input v-model.number="item.quantity" type="number" min="1" aria-label="Quantity" />
          <button type="button" class="button" @click="invoice.items.splice(invoice.items.indexOf(item), 1)">
            Remove
          </button>
        </li>
      </ul>
      <div class="add">
        <input v-model="draft" placeholder="New item" aria-label="New item" />
        <button class="button">Add</button>
      </div>
      <PdfDownloadLink
        v-slot="{ loading }"
        class="button"
        :document="InvoiceDocument"
        :document-props="invoice"
        :file-name="`invoice-${invoice.number}.pdf`"
      >
        {{ loading ? 'Preparing…' : 'Download PDF' }}
      </PdfDownloadLink>
    </form>
    <PdfViewer class="viewer" :document="InvoiceDocument" :document-props="invoice">
      <template #error="{ error }">
        <p class="note">Rendering failed: {{ error }}</p>
      </template>
    </PdfViewer>
  </div>
</template>
