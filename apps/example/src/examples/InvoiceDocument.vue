<script setup lang="ts">
import { computed } from 'vue'
import { Document, Page, StyleSheet, Text, View } from 'vue-pdf-document'

import type { InvoiceItem } from './invoice'

const props = defineProps<{ number: string; customer: string; items: InvoiceItem[]; paid: boolean }>()

const money = (value: number) => `€${value.toFixed(2)}`
const total = computed(() => props.items.reduce((sum, item) => sum + item.quantity * item.price, 0))

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottom: '1pt solid #e5e7eb' },
  head: { fontFamily: 'Helvetica-Bold', borderBottom: '1pt solid #111827' },
  name: { flexGrow: 1 },
  cell: { width: 70, textAlign: 'right' },
  total: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  stamp: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    padding: 8,
    fontSize: 18,
    color: '#059669',
    border: '2pt solid #059669',
  },
})
</script>

<template>
  <Document :title="`Invoice ${number}`" author="vue-pdf-document demo">
    <Page size="A4" :style="styles.page">
      <View :style="styles.header">
        <View>
          <Text :style="styles.title">Invoice</Text>
          <Text :style="styles.muted">No. {{ number }}</Text>
        </View>
        <View>
          <Text :style="styles.muted">Bill to</Text>
          <Text>{{ customer }}</Text>
        </View>
      </View>

      <View :style="[styles.row, styles.head]">
        <Text :style="styles.name">Item</Text>
        <Text :style="styles.cell">Qty</Text>
        <Text :style="styles.cell">Price</Text>
        <Text :style="styles.cell">Amount</Text>
      </View>
      <View v-for="item in items" :key="item.id" :style="styles.row" :wrap="false">
        <Text :style="styles.name">{{ item.name }}</Text>
        <Text :style="styles.cell">{{ item.quantity }}</Text>
        <Text :style="styles.cell">{{ money(item.price) }}</Text>
        <Text :style="styles.cell">{{ money(item.quantity * item.price) }}</Text>
      </View>

      <View :style="styles.total">
        <Text>Total {{ money(total) }}</Text>
      </View>

      <Text v-if="paid" :style="styles.stamp">PAID</Text>
    </Page>
  </Document>
</template>
