<script setup lang="ts">
import { defineAsyncComponent, defineComponent, h, ref } from 'vue'

// The link and its document load in their own chunk once the demo mounts, but `lazy` keeps
// the engine idle until the link is hovered, focused or clicked. A click that lands first
// waits for the file.
const LazyReportLink = defineAsyncComponent(async () => {
  const [{ PdfDownloadLink }, { default: ReportDocument }] = await Promise.all([
    import('vue-pdf-document'),
    import('../examples/ReportDocument.vue'),
  ])
  return defineComponent(
    (_, { attrs, slots }) =>
      () =>
        h(PdfDownloadLink, { ...attrs, document: ReportDocument }, slots),
  )
})
const linkState = ref('Nothing rendered yet.')
const onRendered = ({ pageCount }: { pageCount: number }) => {
  linkState.value = `Rendered ${pageCount} pages on first touch.`
}

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
  <LazyReportLink
    lazy
    class="button"
    :document-props="{ sections: 10 }"
    file-name="short-report.pdf"
    data-lazy-link
    @rendered="onRendered"
  >
    Download a 10-section report (lazy link)
  </LazyReportLink>
  <p class="note" data-lazy-result>{{ linkState }}</p>
</template>
