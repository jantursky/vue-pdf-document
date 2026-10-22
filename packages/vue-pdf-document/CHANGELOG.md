# Changelog

All notable changes to `vue-pdf-document` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
[1.0.0]: https://www.npmjs.com/package/vue-pdf-document/v/1.0.0
