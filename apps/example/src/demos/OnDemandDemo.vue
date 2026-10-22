<script setup lang="ts">
import { ref } from 'vue'

const busy = ref(false)
const result = ref('')

// Nothing PDF-related loads until the click: the library, the engine and the document
// arrive in their own chunks, so pages that never export pay nothing for them.
const download = async () => {
  busy.value = true
  const started = performance.now()
  try {
    const [{ renderToBlob }, { default: ReportDocument }] = await Promise.all([
      import('vue-pdf-document'),
      import('../examples/ReportDocument.vue'),
    ])
    const blob = await renderToBlob(ReportDocument, { sections: 20 })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'report.pdf'
    link.click()
    // A slow download may still be reading the blob, so the URL is revoked well after the click.
    setTimeout(() => URL.revokeObjectURL(link.href), 40_000)
    result.value = `report.pdf, ${(blob.size / 1024).toFixed(1)} kB in ${Math.round(performance.now() - started)} ms`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button type="button" class="button" :disabled="busy" @click="download">
    {{ busy ? 'Rendering…' : 'Download a 20-section report' }}
  </button>
  <p class="note" data-result>{{ result || 'Nothing rendered yet.' }}</p>
</template>
