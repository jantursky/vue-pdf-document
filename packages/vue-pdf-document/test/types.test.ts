// The assertions here run at compile time: `bun run typecheck` fails when the public
// types drift. At runtime the file only checks that the exports exist.
import { describe, expectTypeOf, it } from 'vitest'
import type { Ref } from 'vue'

import {
  pdf,
  PdfRenderError,
  renderToBlob,
  renderToBuffer,
  renderToStream,
  StyleSheet,
  usePdf,
  type DocumentProps,
  type Page,
  type PdfInstance,
  type RenderInfo,
  type RenderOptions,
  type RenderPhase,
  type Text,
  type Style,
  type UsePdfReturn,
  type View,
} from '../src'
import Invoice from './fixtures/Invoice.vue'

type PropsOf<T extends abstract new (...args: never) => { $props: unknown }> = InstanceType<T>['$props']

describe('public types', () => {
  it('types primitive props', () => {
    expectTypeOf<PropsOf<typeof Page>>().toHaveProperty('size')
    expectTypeOf<PropsOf<typeof View>['wrap']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<PropsOf<typeof Text>['orphans']>().toEqualTypeOf<number | undefined>()

    // @ts-expect-error orientation is portrait or landscape
    expectTypeOf<PropsOf<typeof Page>['orientation']>().toEqualTypeOf<'sideways' | undefined>()
  })

  it('keeps style literals narrow in StyleSheet.create', () => {
    const styles = StyleSheet.create({ row: { flexDirection: 'row' } })
    expectTypeOf(styles.row).toExtend<Style>()
    // @ts-expect-error not a flexDirection value
    StyleSheet.create({ row: { flexDirection: 'sideways' } })
  })

  it('types the render functions and the composable', () => {
    expectTypeOf(renderToBuffer).returns.toEqualTypeOf<Promise<Uint8Array>>()
    expectTypeOf(renderToBlob).returns.toEqualTypeOf<Promise<Blob>>()
    expectTypeOf(pdf).returns.toEqualTypeOf<PdfInstance>()
    expectTypeOf(usePdf).returns.toEqualTypeOf<UsePdfReturn>()
    expectTypeOf<UsePdfReturn['url']>().toEqualTypeOf<Readonly<Ref<string | null>>>()
    expectTypeOf<UsePdfReturn['pageCount']>().toEqualTypeOf<Readonly<Ref<number | null>>>()
    expectTypeOf(usePdf).toBeCallableWith(Invoice, undefined, { enabled: () => true, debounce: 50 })
    expectTypeOf(renderToBuffer).toBeCallableWith(Invoice, { customer: 'Ada', items: [] })
  })

  it('types render options, results and errors', () => {
    expectTypeOf<RenderOptions>().toEqualTypeOf<{ signal?: AbortSignal }>()
    expectTypeOf<RenderInfo>().toEqualTypeOf<{ blob: Blob; pageCount: number }>()
    expectTypeOf<NonNullable<DocumentProps['onRender']>>().parameter(0).toEqualTypeOf<RenderInfo>()
    expectTypeOf<PdfInstance['pageCount']>().toEqualTypeOf<number | null>()
    expectTypeOf<PdfInstance['toStream']>().returns.toEqualTypeOf<ReadableStream<Uint8Array>>()
    expectTypeOf(renderToStream).returns.toEqualTypeOf<ReadableStream<Uint8Array>>()
    expectTypeOf(renderToBuffer).toBeCallableWith(Invoice, undefined, { signal: AbortSignal.abort() })
    expectTypeOf(new PdfRenderError('layout', new Error('x'))).toExtend<Error>()
    expectTypeOf<PdfRenderError['phase']>().toEqualTypeOf<RenderPhase>()
    expectTypeOf<RenderPhase>().toEqualTypeOf<'snapshot' | 'layout' | 'render'>()

    // Never called: the checks are for the compiler.
    const misuse = (instance: PdfInstance) => {
      // @ts-expect-error pageCount is read only
      instance.pageCount = 2
      // @ts-expect-error signal must be an AbortSignal
      void instance.toBlob({ signal: true })
    }
    expectTypeOf(misuse).toBeFunction()
  })
})
