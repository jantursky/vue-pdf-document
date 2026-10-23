<p align="center"><img src="https://raw.githubusercontent.com/jantursky/vue-pdf-document/main/apps/docs/public/icon.svg" alt="" width="64" height="64" /></p>

# vue-pdf-document

[![npm](https://img.shields.io/npm/v/vue-pdf-document)](https://www.npmjs.com/package/vue-pdf-document) [![CI](https://github.com/jantursky/vue-pdf-document/actions/workflows/ci.yml/badge.svg)](https://github.com/jantursky/vue-pdf-document/actions/workflows/ci.yml) [![types](https://img.shields.io/npm/types/vue-pdf-document)](https://www.npmjs.com/package/vue-pdf-document) [![license](https://img.shields.io/npm/l/vue-pdf-document)](https://github.com/jantursky/vue-pdf-document/blob/main/LICENSE) [![codecov](https://codecov.io/gh/jantursky/vue-pdf-document/graph/badge.svg)](https://codecov.io/gh/jantursky/vue-pdf-document) [![min+gzip](https://deno.bundlejs.com/badge?q=vue-pdf-document&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22vue%22%2C%22%40react-pdf/%2A%22%2C%22pdfkit%22%5D%7D%7D)](https://bundlejs.com/?q=vue-pdf-document&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22vue%22%2C%22%40react-pdf/%2A%22%2C%22pdfkit%22%5D%7D%7D)

[Docs](https://vue-pdf-document-docs.vercel.app) · [Demo](https://vue-pdf-document.vercel.app) · [Changelog](https://github.com/jantursky/vue-pdf-document/blob/main/packages/vue-pdf-document/CHANGELOG.md) · [GitHub](https://github.com/jantursky/vue-pdf-document)

[![An invoice form next to a live PDF preview that follows every edit](https://raw.githubusercontent.com/jantursky/vue-pdf-document/main/.github/assets/generator-light.png)](https://vue-pdf-document.vercel.app/#generator)

Create PDF files with Vue 3 components. Write `<Document>`, `<Page>`, `<View>` and `<Text>` in a template, with props, `v-for`, `v-if` and computed values, and get a real PDF with selectable text, in the browser or in Node.

Under the hood it's a custom Vue renderer (`createRenderer`) on top of [react-pdf](https://react-pdf.org)'s layout engine. Only `@react-pdf/renderer` in that project depends on React; the layout engine, text shaping, pagination and the pdfkit writer take a plain node tree. This package builds that tree with Vue instead of React's reconciler, so layout, styles, fonts and page breaks behave exactly as in react-pdf.

## Install

```sh
bun add vue-pdf-document
# or: npm install vue-pdf-document, pnpm add vue-pdf-document, yarn add vue-pdf-document
```

It requires Vue `^3.5` and is ESM only. The engine (Yoga, fontkit, pdfkit) adds about 370 kB gzipped to a browser bundle.

## Quick start

```vue
<!-- InvoiceDocument.vue -->
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
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { reactive } from 'vue'
import { PdfDownloadLink, PdfViewer } from 'vue-pdf-document'

import InvoiceDocument from './InvoiceDocument.vue'

const invoice = reactive({ customer: 'Ada', items: [{ name: 'Design review', price: 240 }] })
</script>

<template>
  <input v-model="invoice.customer" />
  <PdfViewer :document="InvoiceDocument" :document-props="invoice" style="height: 600px" />
  <PdfDownloadLink :document="InvoiceDocument" :document-props="invoice" file-name="invoice.pdf" />
</template>
```

The preview renders again, debounced, whenever the data the document reads changes.

## API

| export                                                            | what it does                                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Document`, `Page`, `View`, `Text`, `Link`, `Image`, `Note`       | The react-pdf primitives, as Vue components.                                                                                                  |
| `Canvas`, `Svg`, `G`, `Path`, `Rect`, `Circle`, …                 | Canvas drawing and the SVG set.                                                                                                               |
| `<PdfViewer>`                                                     | Renders a document into an `<iframe>`, with `loading` and `error` slots, `page`, `zoom` and `toolbar` hints, and `rendered` / `error` events. |
| `<PdfDownloadLink>`                                               | An `<a download>` that points at the rendered file; `lazy` renders only when the link is touched.                                             |
| `usePdf(document, props?, { debounce, enabled, inheritContext })` | `blob`, `url`, `loading`, `error` and `pageCount` refs that follow reactive changes.                                                          |
| `renderToBlob(document, props?)`                                  | Renders once to a `Blob`.                                                                                                                     |
| `renderToBuffer(document, props?)`                                | Renders once to a `Uint8Array`; works in Node and workers.                                                                                    |
| `renderToStream(document, props?)`                                | Renders once to a web `ReadableStream` of PDF chunks.                                                                                         |
| `pdf(document, props?)`                                           | The low-level handle: `toBlob()`, `toBuffer()`, `toStream()`, `pageCount`, `onChange()`, `unmount()`.                                         |
| `PdfRenderError`                                                  | What a failed render rejects with; `phase` names the step that failed.                                                                        |
| `Font`, `StyleSheet`                                              | react-pdf's font store, and a typed identity helper for styles.                                                                               |

Props passed to `usePdf`, the render functions and `document-props` are type-checked against the props the document declares.

Every render function and method takes `{ signal }` as its last argument, so an `AbortController` can cancel a render that's no longer needed.

In templates, kebab-case attributes reach the engine in camelCase, flags such as `fixed`, `break` and `wrap` work as bare attributes, `:style` takes objects or arrays, and the `#render` slot replaces react-pdf's `render` prop for page numbers.

The document is mounted as its own Vue app. Pass `inheritContext: true` to `usePdf` (or `inherit-context` to the components) to let it see the page's `provide`s and plugins such as vue-i18n, or install plugins on its own app with the `setup(app)` option of the render functions.

## License

MIT. The layout engine and renderer are [react-pdf](https://github.com/diegomura/react-pdf) packages (MIT) by Diego Muracciole and contributors.
