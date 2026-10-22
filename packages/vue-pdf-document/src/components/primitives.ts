import * as P from '@react-pdf/primitives'
import { defineComponent, h, type SlotsType, type VNode, type VNodeChild } from 'vue'

import type {
  DocumentProps,
  DynamicProps,
  ImageProps,
  LinkProps,
  PageProps,
  SvgProps,
  TextProps,
  ViewProps,
} from './types'

/** Props that are flags in templates: `<View fixed>` must arrive as `true`, not `''`. */
const FLAGS = ['fixed', 'break', 'debug', 'wrap', 'cache'] as const

interface PrimitiveSlots {
  default?: () => VNode[]
  /** Rendered during pagination with the page numbers, in place of the default slot. */
  render?: (props: DynamicProps) => VNodeChild
}

/**
 * A component that renders one @react-pdf primitive. Props pass straight through to
 * the node, except flags, which are declared so Vue casts them to booleans. A `render`
 * slot becomes layout's `render` prop, so page numbers can be written in the template.
 */
const primitive = <Props extends object>(name: string, type: string) =>
  defineComponent(
    (props: Props, { attrs, slots }) =>
      () => {
        const flags = Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
        const renderSlot = slots.render
        const nodeProps = renderSlot ? { ...attrs, ...flags, render: renderSlot } : { ...attrs, ...flags }
        return h(type, nodeProps, renderSlot ? undefined : slots.default?.())
      },
    {
      name,
      inheritAttrs: false,
      // Vue's types want every prop listed; the rest arrive as attrs and pass through above.
      props: Object.fromEntries(FLAGS.map((flag) => [flag, { type: Boolean, default: undefined }])) as never,
      slots: Object as SlotsType<PrimitiveSlots>,
    },
  )

export const Document = primitive<DocumentProps>('Document', P.Document)
export const Page = primitive<PageProps>('Page', P.Page)
export const View = primitive<ViewProps>('View', P.View)
export const Text = primitive<TextProps>('Text', P.Text)
export const Link = primitive<LinkProps>('Link', P.Link)
export const Image = primitive<ImageProps>('Image', P.Image)
export const Note = primitive<{ style?: ViewProps['style'] }>('Note', P.Note)
export const Canvas = primitive<ViewProps & { paint?: (...args: unknown[]) => unknown }>('Canvas', P.Canvas)

export const Svg = primitive<SvgProps>('Svg', P.Svg)
export const G = primitive<SvgProps>('G', P.G)
export const Path = primitive<SvgProps>('Path', P.Path)
export const Rect = primitive<SvgProps>('Rect', P.Rect)
export const Line = primitive<SvgProps>('Line', P.Line)
export const Circle = primitive<SvgProps>('Circle', P.Circle)
export const Ellipse = primitive<SvgProps>('Ellipse', P.Ellipse)
export const Polygon = primitive<SvgProps>('Polygon', P.Polygon)
export const Polyline = primitive<SvgProps>('Polyline', P.Polyline)
export const Tspan = primitive<SvgProps>('Tspan', P.Tspan)
export const Defs = primitive<SvgProps>('Defs', P.Defs)
export const Stop = primitive<SvgProps>('Stop', P.Stop)
export const ClipPath = primitive<SvgProps>('ClipPath', P.ClipPath)
export const LinearGradient = primitive<SvgProps>('LinearGradient', P.LinearGradient)
export const RadialGradient = primitive<SvgProps>('RadialGradient', P.RadialGradient)
