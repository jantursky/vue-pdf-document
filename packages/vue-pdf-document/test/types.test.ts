// The assertions here run at compile time: `bun run typecheck` fails when the public
// types drift. At runtime the file only checks that the exports exist.
import { describe, expectTypeOf, it } from 'vitest'
import type { Ref } from 'vue'

import {
  pdf,
  renderToBlob,
  renderToBuffer,
  StyleSheet,
  usePdf,
  type Page,
  type PdfInstance,
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
    expectTypeOf(renderToBuffer).toBeCallableWith(Invoice, { customer: 'Ada', items: [] })
  })
})
