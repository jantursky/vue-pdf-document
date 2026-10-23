# Changelog

All notable changes to `vue-pdf-document` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-10-23

### Added

- A `setup(app)` option on `pdf()`, `renderToBlob()`, `renderToBuffer()` and `renderToStream()`, called with the document's Vue app before it mounts, to install plugins or provide values. New type: `PdfOptions`.
- `usePdf` option `inheritContext`, and an `inherit-context` prop on `<PdfViewer>` and `<PdfDownloadLink>`: the document sees what the calling component can inject, plus the app's global components, directives, `globalProperties` and plugin state, so `useI18n()` works inside it. Off by default.
- `DocumentPropsOf<C>`, the props type a document component declares. New argument types `PdfArgs`, `RenderArgs` and `UsePdfArgs`.
- Per-element prop types for the SVG primitives (`RectProps`, `PathProps`, `CircleProps`, `LinearGradientProps` and the rest, plus `SvgElementProps` and `SVGPresentationAttributes`), and `CanvasProps` with a typed `CanvasPainter`.

### Changed

- Types only, no runtime change: document props are checked against the document. `usePdf`, `pdf`, `renderToBlob`, `renderToBuffer` and `renderToStream` type their props argument from the component, and require it when the document has required props. `<PdfViewer>` and `<PdfDownloadLink>` are generic, so `document-props` is checked in templates. Documents without declared props still take anything.

  ```ts
  // InvoiceDocument: defineProps<{ customer: string; total: number }>()
  renderToBuffer(InvoiceDocument, { custmer: 'Ada' }) // compiled before, now an error
  renderToBuffer(InvoiceDocument, { customer: 'Ada', total: 42 }) // fine
  ```

- Types only: SVG elements no longer accept any attribute. Each takes its own geometry and the presentation attributes react-pdf draws, and requires what it can't be drawn without (`d` on `Path`, `width` and `height` on `Rect`, `r` on `Circle`, `id` on gradients and `ClipPath`). With `vueCompilerOptions.checkUnknownProps`, unknown template attributes are errors too.

  ```vue
  <Rect widht="80" height="80" />
  <!-- compiled before, now an error: width is required -->
  <Rect width="80" height="80" />
  <!-- fine -->
  ```

### Fixed

- Components returned from a `render` prop or `#render` slot now run with the document's app context, so they see its plugins, global components and app-level provides. Before, they ran with an empty context.

## [1.1.0] - 2026-10-23

### Added

- `renderToStream()` and `PdfInstance.toStream()`: the file as a web `ReadableStream<Uint8Array>`, emitted in chunks as pdfkit writes it. Cancelling the stream aborts the render, and `renderToStream()` unmounts the document when the stream ends.
- A `{ signal }` option on every render function and method. An aborted render rejects with a `DOMException` named `AbortError`, skips `onRender`, and leaves the instance ready for the next render.
- `PdfInstance.pageCount`, the page count of the last finished render. `<Document onRender>` now receives `{ blob, pageCount }`.
- `PdfRenderError`, with `phase` (`snapshot`, `layout` or `render`) and the original error as `cause`. New types: `RenderOptions`, `RenderInfo`, `RenderPhase`.
- `usePdf` option `enabled` (a boolean, ref or getter): while `false`, nothing renders and a pending render is dropped; turning it `true` renders once. `<PdfViewer>` and `<PdfDownloadLink>` take it as a prop.
- `usePdf` returns a `pageCount` ref, and aborts a render that a newer one overtakes instead of letting it finish.
- `rendered` (`{ blob, url, pageCount }`) and `error` events on `<PdfViewer>` and `<PdfDownloadLink>`.
- `<PdfDownloadLink lazy>`: renders only once the link is hovered, focused or clicked. A click before the file is ready is held and starts the download when it is.
- `page`, `zoom` and `toolbar` props on `<PdfViewer>`, passed to the browser's viewer in the URL fragment.

### Changed

- A failed render rejects with a `PdfRenderError` instead of the engine's own error. Its message is the original one with a `[vue-pdf-document]` prefix, and the original error is in `cause`.
- The pdfkit document is created after layout instead of before, so a render aborted during layout never starts writing a file.

## [1.0.1] - 2026-10-22

### Changed

- Published from GitHub Actions with npm provenance. The code is the same as in 1.0.0.

## [1.0.0] - 2026-10-22

The first stable version.

### Added

- A custom Vue renderer (`createRenderer`) that builds the node tree `@react-pdf/layout` reads, so react-pdf's layout engine, pagination and pdfkit output run unchanged.
- Primitives: `Document`, `Page`, `View`, `Text`, `Link`, `Image`, `Note`, `Canvas`, and the SVG set (`Svg`, `G`, `Path`, `Rect`, `Line`, `Circle`, `Ellipse`, `Polygon`, `Polyline`, `Tspan`, `Defs`, `Stop`, `ClipPath`, `LinearGradient`, `RadialGradient`).
- Template-friendly props: flags such as `<View fixed>` cast to booleans, kebab-case attributes and style keys camelized, and a `render` slot for page numbers.
- `pdf()`, `renderToBuffer()` and `renderToBlob()`, in Node, workers and the browser from one entry.
- `usePdf()`: a Blob and object URL that re-render after reactive changes, with a debounce. It starts on mount, so server-side rendering never runs the engine, and keeps a replaced URL valid for 10 seconds so a download or frame still reading it can finish.
- `<PdfViewer>` and `<PdfDownloadLink>`.
- `Font` and `StyleSheet`, with the same API as react-pdf. The font store is created on first use, so importing the package has no side effects.
- ESM only, with bundled type declarations. CommonJS code can load it through `import()` or Node's `require(esm)`.
- An invoice generator in the demo app, on its own tab: VAT per rate, discounts, reverse charge, an EPC payment QR code, a logo, English and Slovak, and JSON export and import.

[Unreleased]: https://www.npmjs.com/package/vue-pdf-document
[1.2.0]: https://www.npmjs.com/package/vue-pdf-document/v/1.2.0
[1.1.0]: https://www.npmjs.com/package/vue-pdf-document/v/1.1.0
[1.0.1]: https://www.npmjs.com/package/vue-pdf-document/v/1.0.1
[1.0.0]: https://www.npmjs.com/package/vue-pdf-document/v/1.0.0
