<!--
  Generated from packages/vue-pdf-document/README.md by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { Document, Page, StyleSheet, Text, View } from 'vue-pdf-document'

defineProps<{ customer: string; items: { name: string; price: number }[] }>()

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
})
</script>

<template>
  <Document title="Invoice">
    <Page size="A4" :style="styles.page">
      <Text>Bill to {{ customer }}</Text>
      <View v-for="item in items" :key="item.name" :style="styles.row">
        <Text>{{ item.name }}</Text>
        <Text>€{{ item.price }}</Text>
      </View>
      <Text fixed :style="{ position: 'absolute', bottom: 20, right: 40 }">
        <template #render="{ pageNumber, totalPages }">{{ pageNumber }} / {{ totalPages }}</template>
      </Text>
    </Page>
  </Document>
</template>
