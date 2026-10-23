// The assertions here run at compile time: `bun run typecheck` fails when the public
// types drift. At runtime the file only checks that the exports exist.
import { describe, expectTypeOf, it } from 'vitest'
import { defineAsyncComponent, defineComponent, h, ref, type FunctionalComponent, type Ref } from 'vue'

import {
  pdf,
  PdfRenderError,
  renderToBlob,
  renderToBuffer,
  renderToStream,
  StyleSheet,
  usePdf,
  type DocumentProps,
  type CanvasPainter,
  type PdfDownloadLink,
  type PdfViewer,
  type CircleProps,
  type DocumentPropsOf,
  type LinearGradientProps,
  type PathProps,
  type RectProps,
  type SvgProps,
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
    expectTypeOf(usePdf<typeof Invoice>).toBeCallableWith(
      Invoice,
      { customer: 'Ada', items: [] },
      { enabled: () => true },
    )
    expectTypeOf(renderToBuffer).toBeCallableWith(Invoice, { customer: 'Ada', items: [] })
  })

  it('types render options, results and errors', () => {
    expectTypeOf<RenderOptions>().toEqualTypeOf<{ signal?: AbortSignal }>()
    expectTypeOf<RenderInfo>().toEqualTypeOf<{ blob: Blob; pageCount: number }>()
    expectTypeOf<NonNullable<DocumentProps['onRender']>>().parameter(0).toEqualTypeOf<RenderInfo>()
    expectTypeOf<PdfInstance['pageCount']>().toEqualTypeOf<number | null>()
    expectTypeOf<PdfInstance['toStream']>().returns.toEqualTypeOf<ReadableStream<Uint8Array>>()
    expectTypeOf(renderToStream).returns.toEqualTypeOf<ReadableStream<Uint8Array>>()
    expectTypeOf(renderToBuffer<typeof Invoice>).toBeCallableWith(
      Invoice,
      { customer: 'Ada', items: [] },
      { signal: AbortSignal.abort() },
    )
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

  it('reads the props a document declares', () => {
    const _Declared = defineComponent({
      props: { customer: { type: String, required: true }, count: { type: Number, default: 0 } },
      setup: () => () => h('div'),
    })
    const Loose = defineComponent(() => () => h('div'))
    const _Functional: FunctionalComponent<{ title: string }> = (props) => h('div', props.title)
    const _Async = defineAsyncComponent(() => Promise.resolve(Loose))

    expectTypeOf<DocumentPropsOf<typeof Invoice>>().toEqualTypeOf<{
      readonly customer: string
      readonly items: { name: string; price: number }[]
      readonly draft?: boolean
    }>()
    // A prop with a default is optional for the caller.
    expectTypeOf<DocumentPropsOf<typeof _Declared>>().toEqualTypeOf<{
      readonly customer: string
      count?: number
    }>()
    expectTypeOf<DocumentPropsOf<typeof _Functional>>().toEqualTypeOf<{ title: string }>()
    expectTypeOf<DocumentPropsOf<typeof Loose>>().toEqualTypeOf<Record<string, unknown>>()
    expectTypeOf<DocumentPropsOf<typeof _Async>>().toEqualTypeOf<Record<string, unknown>>()
  })

  it('checks props against the document', () => {
    const items: { name: string; price: number }[] = []
    const customer = ref('Ada')
    // Never called: the checks are for the compiler.
    const calls = () => {
      void renderToBuffer(Invoice, { customer: 'Ada', items })
      void renderToBlob(Invoice, { customer: 'Ada', items, draft: true }, { signal: AbortSignal.abort() })
      void renderToStream(Invoice, { customer: 'Ada', items })
      pdf(Invoice, () => ({ customer: customer.value, items }))
      pdf(Invoice, ref({ customer: 'Ada', items }))
      usePdf(Invoice, () => ({ customer: customer.value, items }), { debounce: 0 })
      // A document without declared props takes anything, or nothing.
      void renderToBuffer(defineComponent(() => () => h('div')))
      void renderToBuffer(
        defineComponent(() => () => h('div')),
        { anything: 1 },
      )

      // @ts-expect-error customer is a string
      usePdf(Invoice, { customer: 1, items })
      // @ts-expect-error custmer is not a prop of Invoice
      void renderToBuffer(Invoice, { custmer: 'Ada', items })
      // @ts-expect-error items is required
      void renderToBlob(Invoice, { customer: 'Ada' })
      // @ts-expect-error Invoice has required props, so they can't be left out
      pdf(Invoice)
      // @ts-expect-error the getter returns the wrong shape
      usePdf(Invoice, () => ({ customer: 'Ada', items: 'none' }))
    }
    expectTypeOf(calls).toBeFunction()
  })

  it('checks document-props of the viewer and the link against the document', () => {
    type ViewerProps = Parameters<typeof PdfViewer<typeof Invoice>>[0]
    type LinkProps = Parameters<typeof PdfDownloadLink<typeof Invoice>>[0]
    const items: { name: string; price: number }[] = []
    expectTypeOf<{
      document: typeof Invoice
      documentProps: { customer: string; items: typeof items }
    }>().toExtend<ViewerProps>()
    // @ts-expect-error customer is a string
    const _wrongType: ViewerProps = { document: Invoice, documentProps: { customer: 1, items } }
    // @ts-expect-error custmer is not a prop of Invoice
    const _unknown: LinkProps = { document: Invoice, documentProps: { custmer: 'Ada', items } }
  })

  it('types SVG elements by their own attributes', () => {
    expectTypeOf<{ width: number; height: string; fill: string }>().toExtend<RectProps>()
    expectTypeOf<{ d: string; strokeWidth: number; strokeLinecap: 'round' }>().toExtend<PathProps>()
    expectTypeOf<{ id: string; x1: number }>().toExtend<LinearGradientProps>()
    expectTypeOf<{ viewBox: string; fixed: boolean }>().toExtend<SvgProps>()

    // @ts-expect-error widht is not an attribute, and width is required
    const _misspelled: RectProps = { widht: 10, height: 10 }
    // @ts-expect-error radius is not an attribute of Circle
    const _unknown: CircleProps = { r: 4, radius: 4 }
    // @ts-expect-error a gradient needs an id to be referenced
    const _anonymous: LinearGradientProps = { x1: 0 }
    // @ts-expect-error stroke-linecap takes butt, round or square
    const _linecap: PathProps = { d: 'M0 0', strokeLinecap: 'pointy' }
  })

  it('types the canvas painter', () => {
    expectTypeOf<ReturnType<CanvasPainter['moveTo']>>().toEqualTypeOf<CanvasPainter>()
    // @ts-expect-error painters have no drawSomething method
    expectTypeOf<CanvasPainter['drawSomething']>().toBeNever()
  })
})
