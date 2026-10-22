// pdfkit ships no type declarations. Only the surface `pdf.ts` touches is described.
declare module 'pdfkit' {
  export default class PDFDocument {
    constructor(options?: Record<string, unknown>)
    _root: { data: Record<string, unknown> }
    on(event: 'data', listener: (chunk: Uint8Array) => void): this
    on(event: 'end', listener: () => void): this
    on(event: 'error', listener: (error: unknown) => void): this
  }
}
