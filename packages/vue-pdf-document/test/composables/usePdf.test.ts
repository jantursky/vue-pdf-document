import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick, ref } from 'vue'

import { Document, Page, Text, usePdf } from '../../src'
import { singlePage } from '../fixtures'

const scopes: (() => void)[] = []

const setup = (...args: Parameters<typeof usePdf>) => {
  const scope = effectScope()
  const result = scope.run(() => usePdf(...args))!
  scopes.push(() => scope.stop())
  return { result, stop: () => scope.stop() }
}

const until = async (condition: () => boolean) => {
  await vi.waitFor(() => {
    if (!condition()) throw new Error('not yet')
  })
}

afterEach(() => {
  scopes.splice(0).forEach((stop) => stop())
  vi.restoreAllMocks()
})

describe('usePdf', () => {
  it('renders a blob and an object URL', async () => {
    const { result } = setup(singlePage(() => h(Text, null, () => 'hi')))
    expect(result.loading.value).toBe(true)
    await until(() => !result.loading.value)
    expect(result.blob.value?.type).toBe('application/pdf')
    expect(result.url.value).toMatch(/^blob:/)
    expect(result.error.value).toBeNull()
  })

  it('renders again after a reactive change and revokes the old URL later', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const label = ref('a')
    const { result, stop } = setup(
      singlePage(() => h(Text, null, () => label.value)),
      undefined,
      { debounce: 0 },
    )
    await until(() => result.url.value !== null)
    const first = result.url.value
    label.value = 'b'
    await nextTick()
    expect(result.loading.value).toBe(false)
    await until(() => result.url.value !== first)
    // Still valid for a download that started from it.
    expect(revoke).not.toHaveBeenCalledWith(first)
    const second = result.url.value
    stop()
    expect(revoke).toHaveBeenCalledWith(first)
    expect(revoke).toHaveBeenCalledWith(second)
  })

  it('revokes a replaced URL after the delay', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    const label = ref('a')
    const { result } = setup(
      singlePage(() => h(Text, null, () => label.value)),
      undefined,
      { debounce: 0 },
    )
    await until(() => result.url.value !== null)
    const first = result.url.value
    label.value = 'b'
    await until(() => result.url.value !== first)
    const retire = timeout.mock.calls.find(([, delay]) => delay === 10_000)
    expect(retire).toBeDefined()
    retire![0]()
    expect(revoke).toHaveBeenCalledWith(first)
  })

  it('passes reactive props to the document', async () => {
    const title = ref('One')
    const Doc = defineComponent({
      props: { title: { type: String, required: true } },
      setup: (props) => () => h(Document, { title: props.title }, () => h(Page)),
    })
    const { result } = setup(Doc, () => ({ title: title.value }), { debounce: 0 })
    await until(() => result.blob.value !== null)
    const first = result.blob.value
    title.value = 'Two'
    await until(() => result.blob.value !== first)
  })

  it('reports errors and keeps only the newest result', async () => {
    const NotADocument = defineComponent(() => () => h(Page))
    const { result } = setup(NotADocument)
    await until(() => !result.loading.value)
    expect(result.error.value).toBeInstanceOf(Error)
    expect(result.blob.value).toBeNull()
  })

  it('ignores a render that a newer update overtook', async () => {
    const { result } = setup(singlePage(() => null))
    const first = result.update()
    const second = result.update()
    await Promise.all([first, second])
    expect(result.loading.value).toBe(false)
    expect(result.blob.value).not.toBeNull()
  })

  it('cleans up when the scope stops', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { result, stop } = setup(singlePage(() => null))
    await until(() => result.url.value !== null)
    const url = result.url.value
    stop()
    expect(revoke).toHaveBeenCalledWith(url)
    expect(result.url.value).toBeNull()
  })
})
