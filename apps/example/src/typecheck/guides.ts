// Code samples from the docs guides, assembled so `bun run typecheck` fails when the
// documented API drifts. Not imported by the demo.
import { h } from 'vue'
import { Document, Font, Page, renderToBlob, renderToBuffer, Text } from 'vue-pdf-document'

import InvoiceDocument from './getting-started/InvoiceDocument.vue'

// getting-started.mdx, "Render once"
export const once = async () => {
  const blob = await renderToBlob(InvoiceDocument, { customer: 'Ada', total: 42 })
  const bytes = await renderToBuffer(InvoiceDocument, { customer: 'Ada', total: 42 }) // Uint8Array
  return { blob, bytes }
}

// guides/fonts.mdx
export const fonts = () => {
  Font.register({
    family: 'Inter',
    fonts: [
      { src: '/fonts/Inter-Regular.ttf' },
      { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
      { src: '/fonts/Inter-Italic.ttf', fontStyle: 'italic' },
    ],
  })
  Font.registerEmojiSource({ format: 'png', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/' })
  Font.registerHyphenationCallback((word) => [word]) // never hyphenate
}

// guides/server.mdx, plain Node
export const plainNode = async () => {
  const Hello = { render: () => h(Document, () => h(Page, () => h(Text, () => 'Hello'))) }
  return renderToBuffer(Hello)
}
