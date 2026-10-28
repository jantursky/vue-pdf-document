<script setup lang="ts">
import { computed, inject } from 'vue'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Text,
  View,
} from 'vue-pdf-document'

import { formatters, labels, labelsKey } from './i18n'
import type { Invoice, Party } from './model'
import { computeTotals } from './totals'

const props = defineProps<{ invoice: Invoice; qr: string | null }>()

// The generator provides the labels and renders with `inheritContext`. Rendered on its
// own, the template falls back to the invoice's language.
const t = inject(
  labelsKey,
  computed(() => labels[props.invoice.language]),
  false,
)
const f = computed(() => formatters(props.invoice.language, props.invoice.currency))
const totals = computed(() => computeTotals(props.invoice))
const showVat = computed(() => props.invoice.vatPayer)
const accent = computed(() => props.invoice.accent || '#0f766e')

const addressLines = (party: Party) =>
  [party.street, [party.postalCode, party.city].filter(Boolean).join(' '), party.country].filter(Boolean)

const ids = (party: Party) =>
  [
    [t.value.companyId, party.companyId],
    [t.value.taxId, party.taxId],
    [t.value.vatId, party.vatId],
  ].filter(([, value]) => value)

const parties = computed(() => [
  { label: t.value.supplier, party: props.invoice.seller },
  { label: t.value.customer, party: props.invoice.buyer },
])

const meta = computed(() =>
  [
    [t.value.issueDate, f.value.date(props.invoice.issueDate)],
    [t.value.deliveryDate, f.value.date(props.invoice.deliveryDate)],
    [t.value.dueDate, f.value.date(props.invoice.dueDate)],
    [t.value.paymentMethod, t.value.methods[props.invoice.payment.method]],
    [t.value.variableSymbol, props.invoice.payment.variableSymbol],
    [t.value.orderNumber, props.invoice.orderNumber],
  ].filter(([, value]) => value),
)

// Index, item, quantity, unit, unit price, discount, VAT rate (VAT payers only), amount.
const columns = computed(() => [18, 'auto' as const, 44, 30, 62, 34, ...(showVat.value ? [34] : []), 70])

const showBank = computed(
  () => props.invoice.payment.method === 'transfer' && (props.invoice.payment.iban || props.invoice.payment.bankName),
)

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 64,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#1f2937',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { maxWidth: 140, maxHeight: 56, objectFit: 'contain' },
  brand: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 24, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' },
  number: { fontSize: 11, textAlign: 'right', marginTop: 2, color: '#4b5563' },
  parties: { flexDirection: 'row', gap: 16, marginBottom: 18 },
  party: { flex: 1, padding: 12, borderRadius: 4, backgroundColor: '#f9fafb' },
  label: { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  muted: { color: '#4b5563' },
  idRow: { flexDirection: 'row', marginTop: 1 },
  idLabel: { width: 52, color: '#6b7280' },
  info: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  meta: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  metaCell: { width: '33.33%', marginBottom: 8 },
  metaValue: { fontWeight: 500 },
  bank: { width: 200, flexDirection: 'row', gap: 10 },
  bankText: { flex: 1 },
  qr: { width: 64, height: 64 },
  qrCaption: { fontSize: 6.5, color: '#6b7280', textAlign: 'center', marginTop: 2 },
  tableHead: { color: '#ffffff', fontWeight: 500 },
  row: { borderBottom: '0.5pt solid #e5e7eb' },
  cell: { paddingVertical: 5, paddingHorizontal: 3 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 },
  recap: { width: 250 },
  recapRow: { flexDirection: 'row', paddingVertical: 3, borderBottom: '0.5pt solid #e5e7eb' },
  recapHead: { color: '#6b7280', fontSize: 7.5 },
  recapCell: { flex: 1, textAlign: 'right' },
  totals: { width: 210 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  due: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    padding: 10,
    borderRadius: 4,
    color: '#ffffff',
  },
  dueLabel: { fontSize: 10, fontWeight: 500 },
  dueValue: { fontSize: 14, fontWeight: 700 },
  notes: { marginTop: 24, lineHeight: 1.4 },
  note: { marginTop: 4, color: '#4b5563' },
  signature: { marginTop: 32, width: 180, paddingTop: 4, borderTop: '0.5pt solid #9ca3af', color: '#4b5563' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTop: '0.5pt solid #e5e7eb',
    fontSize: 7.5,
    color: '#6b7280',
  },
})
</script>

<template>
  <Document
    :title="`${t.invoice} ${invoice.number}`"
    :author="invoice.seller.name"
    :subject="`${t.invoice} ${invoice.number} – ${invoice.buyer.name}`"
    :language="invoice.language"
    creator="vue-pdf-document invoice generator"
  >
    <Page size="A4" :style="styles.page">
      <View :style="styles.header">
        <Image v-if="invoice.logo" :src="invoice.logo" :style="styles.logo" />
        <Text v-else :style="[styles.brand, { color: accent }]">{{ invoice.seller.name }}</Text>
        <View>
          <Text :style="[styles.title, { color: accent }]">{{ t.invoice }}</Text>
          <Text :style="styles.number">{{ t.number }} {{ invoice.number }}</Text>
        </View>
      </View>

      <View :style="styles.parties">
        <View v-for="{ label, party } in parties" :key="label" :style="styles.party">
          <Text :style="styles.label">{{ label }}</Text>
          <Text :style="styles.partyName">{{ party.name }}</Text>
          <Text v-for="line in addressLines(party)" :key="line" :style="styles.muted">{{ line }}</Text>
          <View :style="{ marginTop: 6 }">
            <View v-for="[name, value] in ids(party)" :key="name" :style="styles.idRow">
              <Text :style="styles.idLabel">{{ name }}</Text>
              <Text>{{ value }}</Text>
            </View>
          </View>
          <Text v-if="party.email || party.phone" :style="[styles.muted, { marginTop: 4 }]">
            {{ [party.email, party.phone].filter(Boolean).join(' · ') }}
          </Text>
        </View>
      </View>

      <View :style="styles.info">
        <View :style="styles.meta">
          <View v-for="[name, value] in meta" :key="name" :style="styles.metaCell">
            <Text :style="styles.label">{{ name }}</Text>
            <Text :style="styles.metaValue">{{ value }}</Text>
          </View>
        </View>
        <View v-if="showBank" :style="styles.bank">
          <View :style="styles.bankText">
            <Text :style="styles.label">{{ t.bank }}</Text>
            <Text :style="styles.metaValue">{{ invoice.payment.bankName }}</Text>
            <Text :style="[styles.label, { marginTop: 6 }]">{{ t.iban }}</Text>
            <Text :style="styles.metaValue">{{ invoice.payment.iban }}</Text>
            <template v-if="invoice.payment.bic">
              <Text :style="[styles.label, { marginTop: 6 }]">{{ t.bic }}</Text>
              <Text :style="styles.metaValue">{{ invoice.payment.bic }}</Text>
            </template>
          </View>
          <View v-if="qr">
            <Image :src="qr" :style="styles.qr" />
            <Text :style="styles.qrCaption">{{ t.scanToPay }}</Text>
          </View>
        </View>
      </View>

      <Table :columns="columns" striped>
        <TableHeader :style="{ backgroundColor: accent }">
          <TableRow :style="styles.tableHead">
            <TableCell :style="styles.cell">#</TableCell>
            <TableCell :style="styles.cell">{{ t.item }}</TableCell>
            <TableCell align="right" :style="styles.cell">{{ t.quantity }}</TableCell>
            <TableCell :style="styles.cell">{{ t.unit }}</TableCell>
            <TableCell align="right" :style="styles.cell">{{ t.unitPrice }}</TableCell>
            <TableCell align="right" :style="styles.cell">{{ t.discount }}</TableCell>
            <TableCell v-if="showVat" align="right" :style="styles.cell">{{ t.vatRate }}</TableCell>
            <TableCell align="right" :style="styles.cell">{{ t.amount }}</TableCell>
          </TableRow>
        </TableHeader>
        <TableRow v-for="(item, index) in invoice.items" :key="item.id" :style="styles.row">
          <TableCell :style="[styles.cell, styles.muted]">{{ index + 1 }}</TableCell>
          <TableCell :style="styles.cell">{{ item.description }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ f.number(item.quantity) }}</TableCell>
          <TableCell :style="styles.cell">{{ item.unit }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ f.money(item.unitPrice) }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ item.discount ? f.percent(item.discount) : '' }}</TableCell>
          <TableCell v-if="showVat" align="right" :style="styles.cell">{{ f.percent(item.vatRate) }}</TableCell>
          <TableCell align="right" :style="styles.cell">{{ f.money(totals.lines[index] ?? 0) }}</TableCell>
        </TableRow>
      </Table>

      <View :style="styles.summary" :wrap="false">
        <View :style="styles.recap">
          <template v-if="showVat && !invoice.reverseCharge">
            <Text :style="styles.label">{{ t.vatRecap }}</Text>
            <View :style="[styles.recapRow, styles.recapHead]">
              <Text :style="{ width: 40 }">{{ t.vatRate }}</Text>
              <Text :style="styles.recapCell">{{ t.base }}</Text>
              <Text :style="styles.recapCell">{{ t.vat }}</Text>
              <Text :style="styles.recapCell">{{ t.total }}</Text>
            </View>
            <View v-for="line in totals.vat" :key="line.rate" :style="styles.recapRow">
              <Text :style="{ width: 40 }">{{ f.percent(line.rate) }}</Text>
              <Text :style="styles.recapCell">{{ f.money(line.base) }}</Text>
              <Text :style="styles.recapCell">{{ f.money(line.vat) }}</Text>
              <Text :style="styles.recapCell">{{ f.money(line.total) }}</Text>
            </View>
          </template>
        </View>
        <View :style="styles.totals">
          <View :style="styles.totalRow">
            <Text :style="styles.muted">{{ t.subtotal }}</Text>
            <Text>{{ f.money(totals.subtotal) }}</Text>
          </View>
          <View v-if="showVat" :style="styles.totalRow">
            <Text :style="styles.muted">{{ t.vatTotal }}</Text>
            <Text>{{ f.money(totals.vatTotal) }}</Text>
          </View>
          <View :style="[styles.due, { backgroundColor: accent }]">
            <Text :style="styles.dueLabel">{{ t.amountDue }}</Text>
            <Text :style="styles.dueValue">{{ f.money(totals.total) }}</Text>
          </View>
        </View>
      </View>

      <View :style="styles.notes" :wrap="false">
        <Text v-if="invoice.notes">{{ invoice.notes }}</Text>
        <Text v-if="!invoice.vatPayer" :style="styles.note">{{ t.notVatPayer }}</Text>
        <Text v-else-if="invoice.reverseCharge" :style="styles.note">{{ t.reverseCharge }}</Text>
        <Text v-if="invoice.issuedBy" :style="styles.signature">{{ t.issuedBy }}: {{ invoice.issuedBy }}</Text>
      </View>

      <View :style="styles.footer" fixed>
        <Text>
          {{
            [
              invoice.seller.name,
              invoice.seller.companyId && `${t.companyId} ${invoice.seller.companyId}`,
              invoice.seller.email,
            ]
              .filter(Boolean)
              .join(' · ')
          }}
        </Text>
        <Text>
          <template #render="{ pageNumber, totalPages }">{{ t.page(pageNumber, totalPages) }}</template>
        </Text>
      </View>
    </Page>
  </Document>
</template>
