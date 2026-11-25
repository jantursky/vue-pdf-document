import { describe, expect, it } from 'vitest'

import { createPdfWorker } from '../../src/worker'
import type { documents } from './doc.worker'

describe('a real worker', () => {
  it('renders a document off the main thread', async () => {
    const worker = new Worker(new URL('./doc.worker.ts', import.meta.url), { type: 'module' })
    const client = createPdfWorker<typeof documents>(worker)
    try {
      const blob = await client.render('doc', { sections: 3 })
      expect(blob.type).toBe('application/pdf')
      expect(new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer())).toBe('%PDF-')

      const controller = new AbortController()
      const aborted = client.render('doc', { sections: 3 }, { signal: controller.signal })
      controller.abort()
      await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
      expect((await client.render('doc')).size).toBeGreaterThan(500)
    } finally {
      client.terminate()
    }
  })
})
