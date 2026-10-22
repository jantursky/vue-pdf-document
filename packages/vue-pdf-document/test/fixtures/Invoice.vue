<script setup lang="ts">
import { Document, Page, Text, View } from '../../src'

defineProps<{ customer: string; items: { name: string; price: number }[]; draft?: boolean }>()
</script>

<template>
  <Document title="Invoice" author="Test">
    <Page size="A4" :style="{ padding: 30, fontSize: 12 }">
      <Text v-if="draft" fixed>DRAFT</Text>
      <View :min-presence-ahead="20" :wrap="false">
        <Text>Bill to {{ customer }}</Text>
      </View>
      <View v-for="item in items" :key="item.name">
        <Text>{{ item.name }}: {{ item.price }}</Text>
      </View>
      <Text fixed>
        <template #render="{ pageNumber, totalPages }">{{ pageNumber }} / {{ totalPages }}</template>
      </Text>
    </Page>
  </Document>
</template>
