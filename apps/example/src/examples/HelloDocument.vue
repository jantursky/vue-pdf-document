<script setup lang="ts">
import { Document, Page, StyleSheet, Text, View } from 'vue-pdf-document'

defineProps<{ name: string }>()

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 14 },
  title: { fontSize: 28, marginBottom: 12, color: '#0f766e' },
})
</script>

<template>
  <Document title="Hello">
    <Page size="A5" :style="styles.page">
      <Text :style="styles.title">Hello, {{ name || 'world' }}!</Text>
      <View>
        <Text>This page was rendered by a Vue component, laid out by react-pdf's engine and written by pdfkit.</Text>
      </View>
    </Page>
  </Document>
</template>
