<script setup lang="ts">
import { Document, Page, Text, View } from 'vue-pdf-document'

defineProps<{ sections: number }>()

const paragraph =
  'Pagination, widows and orphans come from the react-pdf layout engine. Vue only builds the tree; ' +
  'the engine measures text with fontkit, breaks it into lines and splits views across pages.'
</script>

<template>
  <Document title="Report">
    <Page size="A5" :style="{ paddingVertical: 48, paddingHorizontal: 36, fontSize: 10 }">
      <Text fixed :style="{ position: 'absolute', top: 20, left: 36, right: 36, fontSize: 8, color: '#9ca3af' }">
        Quarterly report · vue-pdf-document
      </Text>

      <View v-for="index in sections" :key="index" :style="{ marginBottom: 14 }">
        <Text :style="{ fontSize: 14, marginBottom: 4 }" :min-presence-ahead="40">Section {{ index }}</Text>
        <Text>{{ paragraph }} {{ paragraph }}</Text>
      </View>

      <Text fixed :style="{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 8 }">
        <template #render="{ pageNumber, totalPages }">Page {{ pageNumber }} of {{ totalPages }}</template>
      </Text>
    </Page>
  </Document>
</template>
