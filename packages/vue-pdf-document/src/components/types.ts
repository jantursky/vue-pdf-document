import type {
  HyphenationCallback,
  Orientation,
  PageSize,
  SourceObject,
  Style,
  SVGPresentationAttributes,
} from '@react-pdf/types'
import type { AllowedComponentProps, VNodeProps } from 'vue'

export type { Orientation, PageSize, SourceObject, Style, SVGPresentationAttributes }

/** A style object, or an array of them merged left to right, as Vue does for `style` on any element. */
export type PdfStyle = Style | (Style | false | null | undefined)[]

/** What `onRender` receives after a finished `toBlob()`. */
export interface RenderInfo {
  blob: Blob
  pageCount: number
}

export interface DynamicProps {
  pageNumber: number
  totalPages: number
}

export interface BaseProps {
  id?: string
  style?: PdfStyle
  /** Repeat the element on every page. */
  fixed?: boolean
  /** Start the element on a new page. */
  break?: boolean
  /** Draw the layout boxes, for debugging. */
  debug?: boolean
  bookmark?: string | { title: string; fit?: boolean; expanded?: boolean }
  minPresenceAhead?: number
}

export interface DocumentProps {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
  producer?: string
  language?: string
  creationDate?: Date
  modificationDate?: Date
  pdfVersion?: '1.3' | '1.4' | '1.5' | '1.6' | '1.7' | '1.7ext3'
  conformance?: 'PDF/A-1' | 'PDF/A-1b' | 'PDF/A-2' | 'PDF/A-2b' | 'PDF/A-3' | 'PDF/A-3b'
  pageMode?: 'useNone' | 'useOutlines' | 'useThumbs' | 'fullScreen' | 'useOC' | 'useAttachments'
  pageLayout?: 'singlePage' | 'oneColumn' | 'twoColumnLeft' | 'twoColumnRight' | 'twoPageLeft' | 'twoPageRight'
  ownerPassword?: string
  userPassword?: string
  permissions?: {
    printing?: 'lowResolution' | 'highResolution'
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
  style?: PdfStyle
  /** Called with the finished file and its page count after `toBlob()`. */
  onRender?: (result: RenderInfo) => void
}

export interface PageProps extends BaseProps {
  /** `A4` by default. */
  size?: PageSize
  orientation?: Orientation
  wrap?: boolean
  dpi?: number
}

export interface ViewProps extends BaseProps {
  /** `false` keeps the view on one page, moving it to the next if it doesn't fit. */
  wrap?: boolean
  render?: (props: { pageNumber: number; subPageNumber: number }) => unknown
}

export interface TextProps extends BaseProps {
  wrap?: boolean
  widows?: number
  orphans?: number
  hyphenationCallback?: HyphenationCallback
  /** Called during pagination; return a string, a number or vnodes. The `render` slot does the same. */
  render?: (props: DynamicProps) => unknown
}

export interface LinkProps extends BaseProps {
  /** A URL, or `#id` for an element in the same document. */
  src?: string
  href?: string
}

export interface ImageProps extends BaseProps {
  /** A URL, a data URI, a buffer, `{ uri, method, headers, body }`, or a function returning one. */
  src?: SourceObject
  /** Cache remote images between renders. `true` by default. */
  cache?: boolean
}

/** A length in user units. Template attributes arrive as strings, bindings as numbers. */
type SvgLength = number | string

// Element attributes follow what @react-pdf/layout and @react-pdf/render read for each
// SVG element; attributes the engine ignores (such as `fr`) are left out.

/**
 * What every element inside `<Svg>` accepts: the presentation attributes react-pdf
 * draws, an `id` for `url(#id)` references, and `style` holding the same attributes.
 * Attribute names are camelCase; templates may write them in kebab-case.
 */
export interface SvgElementProps extends SVGPresentationAttributes {
  id?: string
  style?: SVGPresentationAttributes | SVGPresentationAttributes[]
}

/** The `<Svg>` root: a layout box like `View`, with the viewport attributes. */
export interface SvgProps extends BaseProps, SVGPresentationAttributes {
  width?: SvgLength
  height?: SvgLength
  viewBox?: string
  preserveAspectRatio?: string
}

export type GProps = SvgElementProps

export interface PathProps extends SvgElementProps {
  d: string
}

export interface RectProps extends SvgElementProps {
  x?: SvgLength
  y?: SvgLength
  width: SvgLength
  height: SvgLength
  rx?: SvgLength
  ry?: SvgLength
}

export interface LineProps extends SvgElementProps {
  x1: SvgLength
  y1: SvgLength
  x2: SvgLength
  y2: SvgLength
}

export interface CircleProps extends SvgElementProps {
  cx?: SvgLength
  cy?: SvgLength
  r: SvgLength
}

export interface EllipseProps extends SvgElementProps {
  cx?: SvgLength
  cy?: SvgLength
  rx: SvgLength
  ry: SvgLength
}

export interface PolygonProps extends SvgElementProps {
  /** `x,y` pairs, such as `'0,0 10,0 5,8'`. */
  points: string
}

export type PolylineProps = PolygonProps

export interface TspanProps extends SvgElementProps {
  x?: SvgLength
  y?: SvgLength
}

export type DefsProps = SvgElementProps

export interface ClipPathProps extends SvgElementProps {
  id: string
}

export interface StopProps extends SvgElementProps {
  offset: SvgLength
  stopColor?: string
  stopOpacity?: SvgLength
}

interface GradientProps extends SvgElementProps {
  id: string
  gradientTransform?: string
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  /** Inherit the stops of another gradient. */
  xlinkHref?: string
}

export interface LinearGradientProps extends GradientProps {
  x1?: SvgLength
  y1?: SvgLength
  x2?: SvgLength
  y2?: SvgLength
}

export interface RadialGradientProps extends GradientProps {
  cx?: SvgLength
  cy?: SvgLength
  r?: SvgLength
  fx?: SvgLength
  fy?: SvgLength
}

type Point = [x: number, y: number]
type Color = string | [number, number, number]

/** A pdfkit gradient, as returned by `linearGradient` and `radialGradient`. */
export interface CanvasGradient {
  stop: (offset: number, color: Color, opacity?: number) => CanvasGradient
}

/**
 * The drawing API `<Canvas paint>` receives: the pdfkit methods react-pdf passes through.
 * Each returns the painter, so calls chain. Origin is the canvas box's top left corner.
 */
export interface CanvasPainter {
  save: () => CanvasPainter
  restore: () => CanvasPainter
  translate: (x: number, y: number) => CanvasPainter
  rotate: (angle: number, options?: { origin?: Point }) => CanvasPainter
  scale: (x: number, y?: number, options?: { origin?: Point }) => CanvasPainter
  moveTo: (x: number, y: number) => CanvasPainter
  lineTo: (x: number, y: number) => CanvasPainter
  bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => CanvasPainter
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => CanvasPainter
  rect: (x: number, y: number, width: number, height: number) => CanvasPainter
  roundedRect: (x: number, y: number, width: number, height: number, radius?: number) => CanvasPainter
  circle: (x: number, y: number, radius: number) => CanvasPainter
  ellipse: (x: number, y: number, radiusX: number, radiusY?: number) => CanvasPainter
  polygon: (...points: Point[]) => CanvasPainter
  /** An SVG path string, such as `'M 0 0 L 10 10'`. */
  path: (path: string) => CanvasPainter
  fill: (color?: Color | CanvasGradient, rule?: 'non-zero' | 'even-odd') => CanvasPainter
  stroke: (color?: Color | CanvasGradient) => CanvasPainter
  fillAndStroke: (fill?: Color | CanvasGradient, stroke?: Color | CanvasGradient) => CanvasPainter
  clip: (rule?: 'non-zero' | 'even-odd') => CanvasPainter
  fillColor: (color: Color | CanvasGradient, opacity?: number) => CanvasPainter
  strokeColor: (color: Color | CanvasGradient, opacity?: number) => CanvasPainter
  opacity: (opacity: number) => CanvasPainter
  fillOpacity: (opacity: number) => CanvasPainter
  strokeOpacity: (opacity: number) => CanvasPainter
  lineWidth: (width: number) => CanvasPainter
  lineCap: (cap: 'butt' | 'round' | 'square') => CanvasPainter
  lineJoin: (join: 'miter' | 'round' | 'bevel') => CanvasPainter
  miterLimit: (limit: number) => CanvasPainter
  dash: (length: number, options?: { space?: number; phase?: number }) => CanvasPainter
  font: (name: string, size?: number) => CanvasPainter
  fontSize: (size: number) => CanvasPainter
  text: (text: string, x?: number, y?: number, options?: Record<string, unknown>) => CanvasPainter
  linearGradient: (x1: number, y1: number, x2: number, y2: number) => CanvasGradient
  radialGradient: (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) => CanvasGradient
}

export interface CanvasProps extends ViewProps {
  /** Draws the canvas. Called during rendering with the painter and the box's inner size. */
  paint?: (painter: CanvasPainter, availableWidth: number, availableHeight: number) => unknown
}

/** Props Vue adds to every component, which mean nothing to a document. */
type InternalProps = keyof VNodeProps | keyof AllowedComponentProps

type OwnProps<P> = { [K in keyof P as K extends InternalProps ? never : K]: P[K] }

/** Declared props, or a loose record when the component declares none it can be checked against. */
type Declared<P> = unknown extends P
  ? Record<string, unknown>
  : string extends keyof P
    ? Record<string, unknown>
    : OwnProps<P>

/**
 * The props a document component declares, without Vue's own (`key`, `ref`, `class`,
 * `style`). Falls back to `Record<string, unknown>` when the component has no props to
 * check against, as with a setup function without `props` or an async component.
 */
export type DocumentPropsOf<C> = C extends abstract new (...args: never) => { $props: infer P }
  ? Declared<P>
  : C extends (props: infer P, ...args: never) => unknown
    ? Declared<P>
    : Record<string, unknown>

/** Keys of `P` that must be given. */
type RequiredKeys<P> = { [K in keyof P]-?: Partial<Pick<P, K>> extends Pick<P, K> ? never : K }[keyof P]

/** `true` when every prop of the document `C` is optional, so its props argument can be left out. */
export type PropsOptional<C> = [RequiredKeys<DocumentPropsOf<C>>] extends [never] ? true : false
