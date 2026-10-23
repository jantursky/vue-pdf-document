import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n, useI18n } from 'vue-i18n'
import { defineComponent, effectScope, h, inject, provide, ref, resolveComponent, type Component } from 'vue'

import { Text, usePdf, type UsePdfReturn } from '../../src'
import { pdfText, singlePage } from '../fixtures'

const wrappers: { unmount: () => void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

const textOf = async (state: UsePdfReturn) => {
  await vi.waitFor(() => expect(state.blob.value).not.toBeNull())
  return pdfText(new Uint8Array(await state.blob.value!.arrayBuffer()))
}

const Theme = defineComponent(() => {
  const theme = inject('theme', 'default theme')
  return () => h(Text, null, () => `Theme: ${typeof theme === 'string' ? theme : (theme as { value: string }).value}`)
})

/** Mounts `Doc` through usePdf inside a component that provides `theme`. */
const host = (Doc: Component, theme: unknown, inheritContext?: boolean) => {
  let state!: UsePdfReturn
  const Host = defineComponent(() => {
    provide('theme', theme)
    state = usePdf(Doc, undefined, { debounce: 0, inheritContext })
    return () => h('div')
  })
  // A parent between the provider and the caller, so the chain has more than one level.
  const wrapper = mount(defineComponent(() => () => h(Host)))
  wrappers.push(wrapper)
  return () => state
}

describe('inheritContext', () => {
  it('lets the document inject what the host component provides', async () => {
    const state = host(
      singlePage(() => h(Theme)),
      'dark',
      true,
    )
    expect(await textOf(state())).toContain('Theme: dark')
  })

  it('re-renders when a provided ref changes', async () => {
    const theme = ref('light')
    const state = host(
      singlePage(() => h(Theme)),
      theme,
      true,
    )
    expect(await textOf(state())).toContain('Theme: light')
    const first = state().blob.value
    theme.value = 'sepia'
    await vi.waitFor(() => expect(state().blob.value).not.toBe(first))
    expect(await textOf(state())).toContain('Theme: sepia')
  })

  it('keeps the document isolated by default', async () => {
    const state = host(
      singlePage(() => h(Theme)),
      'dark',
    )
    expect(await textOf(state())).toContain('Theme: default theme')
  })

  it('has no effect outside a component', async () => {
    const scope = effectScope()
    const state = scope.run(() =>
      usePdf(
        singlePage(() => h(Theme)),
        undefined,
        { inheritContext: true },
      ),
    )!
    expect(await textOf(state)).toContain('Theme: default theme')
    scope.stop()
  })

  it('shares global components and globalProperties of the host app', async () => {
    const Banner = defineComponent(() => () => h(Text, null, () => 'Banner from the host app'))
    const Brand = defineComponent({
      render() {
        return h(Text, null, () => `Brand: ${(this as unknown as { $brand: string }).$brand}`)
      },
    })
    const Doc = singlePage(() => [h(resolveComponent('Banner') as Component), h(Brand)])
    let state!: UsePdfReturn
    const Host = defineComponent(() => {
      state = usePdf(Doc, undefined, { inheritContext: true })
      return () => h('div')
    })
    const wrapper = mount(Host, {
      global: { components: { Banner }, config: { globalProperties: { $brand: 'Acme' } as never } },
    })
    wrappers.push(wrapper)
    const text = await textOf(state)
    expect(text).toContain('Banner from the host app')
    expect(text).toContain('Brand: Acme')
  })
})

describe('with vue-i18n', () => {
  const Labels = defineComponent(() => {
    const { t } = useI18n()
    return () => h(Text, null, () => t('total'))
  })

  it('translates inside the document and follows the locale', async () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { total: 'Total due' }, de: { total: 'Gesamtbetrag' } },
    })
    let state!: UsePdfReturn
    const Host = defineComponent(() => {
      state = usePdf(
        singlePage(() => h(Labels)),
        undefined,
        { debounce: 0, inheritContext: true },
      )
      return () => h('div')
    })
    const wrapper = mount(Host, { global: { plugins: [i18n] } })
    wrappers.push(wrapper)
    expect(await textOf(state)).toContain('Total due')

    const first = state.blob.value
    i18n.global.locale.value = 'de'
    await vi.waitFor(() => expect(state.blob.value).not.toBe(first))
    expect(await textOf(state)).toContain('Gesamtbetrag')
  })
})
