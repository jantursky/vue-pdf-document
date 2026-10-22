<!--
  Generated from apps/docs/docs/getting-started.mdx by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { Document, Page, StyleSheet, Text, View } from 'vue-pdf-document'

defineProps<{ customer: string; total: number }>()

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
})
</script>

<template>
  <Document title="Invoice">
    <Page size="A4" :style="styles.page">
      <View :style="styles.row">
        <Text>Bill to {{ customer }}</Text>
        <Text>Total €{{ total.toFixed(2) }}</Text>
      </View>
    </Page>
  </Document>
</template>
