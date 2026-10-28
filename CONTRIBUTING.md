# Contributing

Thanks for helping. Bug reports, docs fixes and pull requests are all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- If a document renders wrong, try the same tree with `@react-pdf/renderer`. If it fails there too, the bug is in the layout engine and belongs [upstream](https://github.com/diegomura/react-pdf/issues); this library only builds the tree.

## Setup

You need [Bun](https://bun.sh) 1.3+ and Node.js 22.19+ (the version is in `.node-version`).

```sh
bun install
bunx playwright install chromium firefox webkit   # once, for the browser and e2e tests
bun run dev                                       # demo app, reading the library's source
```

## Where things live

| path                                       |                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `packages/vue-pdf-document/src/core`       | The Vue renderer, the snapshot for the layout engine, rendering.                                    |
| `packages/vue-pdf-document/src/components` | Primitives, `PdfViewer`, `PdfDownloadLink`.                                                         |
| `packages/vue-pdf-document/test`           | Unit tests (Node + happy-dom) and `test/browser` (real engines).                                    |
| `apps/example`                             | The demo, its Playwright e2e tests in `e2e/`, and `src/typecheck` with the README and docs samples. |
| `apps/docs`                                | The Blume docs site. Live examples come from `apps/example/src/examples/*Example.vue`.              |

## Checks

```sh
bun run check          # samples in sync, format, lint, typecheck, unit tests with coverage
bun run test:browser   # rendering in Chromium, Firefox and WebKit
bun run test:e2e       # builds the demo and drives it with Playwright
bun run build          # fails over the 7.5 kB size budget
bun run lint:package && bun run test:pack   # after build: publint, types, install the tarball
```

CI runs all of them on every pull request.

## Conventions

- TypeScript strict, `<script setup>` in components, Prettier formatting (`bun run format`).
- Every behavior change comes with a test. Unit tests render real PDFs; `test/fixtures.ts` has helpers to read the text and metadata back.
- Code samples in `packages/vue-pdf-document/README.md` and `apps/docs/docs/getting-started.mdx` are type-checked. After editing them, run `bun run sync:samples`.
- The README screenshots in `.github/assets` come from `bun run screenshots`, which builds the demo and captures it in light and dark. Run it again when the demo's look changes.
- Add a line under `## [Unreleased]` in `packages/vue-pdf-document/CHANGELOG.md` for anything users will notice.
- Breaking changes need a new major version and an entry under **Changed**.

## License

By contributing you agree that your contributions are licensed under the MIT license.
