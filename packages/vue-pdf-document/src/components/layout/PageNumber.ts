import { defineComponent, h, type Component, type SlotsType, type VNodeChild } from 'vue'

import { Text } from '../primitives'
import type { DynamicProps, TextProps } from '../types'

export interface PageNumberProps extends Omit<TextProps, 'fixed' | 'render'> {
  /** Text with `{page}` and `{total}` placeholders. `'{page} / {total}'` by default. */
  format?: string
}

/** A fixed `Text` that shows the page number on every page. Takes every `Text` prop. */
export const PageNumber = defineComponent(
  (props: PageNumberProps, { attrs, slots }) =>
    () => {
      const { format = '{page} / {total}' } = props
      const render = (info: DynamicProps): VNodeChild =>
        slots.default
          ? slots.default(info)
          : format.replace('{page}', String(info.pageNumber)).replace('{total}', String(info.totalPages))
      return h(Text as Component, { ...attrs, fixed: true }, { render })
    },
  {
    name: 'PageNumber',
    inheritAttrs: false,
    props: { format: String } as never,
    slots: Object as SlotsType<{ default?: (props: DynamicProps) => VNodeChild }>,
  },
)
