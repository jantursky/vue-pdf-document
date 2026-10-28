<script setup lang="ts">
import { computed } from 'vue'
import {
  Document,
  Page,
  PageNumber,
  StyleSheet,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Text,
  View,
} from 'vue-pdf-document'

import type { InvoiceItem } from './invoice'

const props = defineProps<{ number: string; customer: string; items: InvoiceItem[]; paid: boolean }>()

const money = (value: number) => `€${value.toFixed(2)}`
const total = computed(() => props.items.reduce((sum, item) => sum + item.quantity * item.price, 0))

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  head: { fontFamily: 'Helvetica-Bold', backgroundColor: '#f3f4f6' },
  cell: { paddingVertical: 6 },
  pageNumber: { position: 'absolute', bottom: 40, left: 40, fontSize: 9, color: '#6b7280' },
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

      <Table :columns="['auto', 70, 70, 70]" striped>
        <TableHeader :style="styles.head">
          <TableRow>
            <TableCell :style="styles.cell">Item</TableCell>
            <TableCell align="right" :style="styles.cell">Qty</TableCell>
            <TableCell align="right" :style="styles.cell">Price</TableCell>
            <TableCell align="right" :style="styles.cell">Amount</TableCell>
          </TableRow>
        </TableHeader>
        <TableRow v-for="item in items" :key="item.id">
          <TableCell :style="styles.cell">{{ item.name }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ item.quantity }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ money(item.price) }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ money(item.quantity * item.price) }}</TableCell>
        </TableRow>
      </Table>

      <View :style="styles.total">
        <Text>Total {{ money(total) }}</Text>
      </View>

      <Text v-if="paid" :style="styles.stamp">PAID</Text>
      <PageNumber format="Page {page} of {total}" :style="styles.pageNumber" />
    </Page>
  </Document>
</template>
