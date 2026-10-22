import type { HyphenationCallback, Orientation, PageSize, SourceObject, Style } from '@react-pdf/types'

export type { Orientation, PageSize, SourceObject, Style }

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

/** SVG elements take their attributes as props, as in the SVG spec. */
export type SvgProps = BaseProps & Record<string, unknown>
