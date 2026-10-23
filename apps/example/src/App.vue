<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref } from 'vue'

import HeadlessDemo from './demos/HeadlessDemo.vue'
import OnDemandDemo from './demos/OnDemandDemo.vue'
import ExamplesSection from './examples/ExamplesSection.vue'
import helloSource from './examples/HelloDocument.vue?raw'
import CodeBlock from './ui/CodeBlock.vue'
import CopyButton from './ui/CopyButton.vue'

// The generator brings its own font files and the QR encoder, so it loads with its tab.
const InvoiceGenerator = defineAsyncComponent(() => import('./generator/InvoiceGenerator.vue'))

const version = __VUE_PDF_VERSION__
const install = 'npm install vue-pdf-document'

type Tab = 'overview' | 'generator'
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'generator', label: 'Invoice generator' },
]

// The tab lives in the URL hash, so #generator links straight to it and Back works.
const fromHash = (): Tab => (location.hash === '#generator' ? 'generator' : 'overview')
const tab = ref<Tab>(fromHash())
const onHashChange = () => {
  tab.value = fromHash()
}
window.addEventListener('hashchange', onHashChange)
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))

const select = (next: Tab) => {
  tab.value = next
  history.pushState(null, '', next === 'generator' ? '#generator' : location.pathname)
}

const tabButtons = ref<HTMLButtonElement[]>([])
const onTabKey = (event: KeyboardEvent, index: number) => {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const next = tabs[(index + step + tabs.length) % tabs.length]
  if (!next) return
  select(next.id)
  tabButtons.value[tabs.indexOf(next)]?.focus()
}

const openGenerator = () => {
  select('generator')
  document.getElementById('tabs')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <header class="nav">
    <div class="container nav-inner">
      <a class="brand" href="/">
        <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
          <mask id="brand-bands">
            <path
              d="M16 6h20v12a6 6 0 0 0 6 6h12v24a10 10 0 0 1-10 10H16A10 10 0 0 1 6 48V16A10 10 0 0 1 16 6Z"
              fill="#fff"
            />
            <path d="M0 30C18 20 36 44 64 24M0 44C18 34 36 58 64 38" stroke="#000" stroke-width="4" fill="none" />
          </mask>
          <g mask="url(#brand-bands)">
            <path
              d="M16 6h20v12a6 6 0 0 0 6 6h12v24a10 10 0 0 1-10 10H16A10 10 0 0 1 6 48V16A10 10 0 0 1 16 6Z"
              style="fill: var(--logo-green)"
            />
            <path d="M0 30C18 20 36 44 64 24V64H0Z" style="fill: var(--logo-band)" />
            <path d="M0 44C18 34 36 58 64 38V64H0Z" style="fill: var(--logo-slate)" />
          </g>
          <path
            d="M41 7.5v9.5a3 3 0 0 0 3 3h9.5Z"
            stroke-width="2"
            stroke-linejoin="round"
            style="fill: var(--logo-slate); stroke: var(--logo-slate)"
          />
        </svg>
        vue-pdf-document
        <span class="version">{{ version }}</span>
      </a>
      <nav class="nav-links" aria-label="Project">
        <a href="https://vue-pdf-document-docs.vercel.app">Docs</a>
        <a href="https://github.com/jantursky/vue-pdf-document">GitHub</a>
        <a href="https://www.npmjs.com/package/vue-pdf-document">npm</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="band band-mist hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="tag">Vue 3 · PDF</p>
          <h1>PDF files from Vue components</h1>
          <p class="lead">
            Write a document with <code>&lt;Document&gt;</code>, <code>&lt;Page&gt;</code>,
            <code>&lt;View&gt;</code> and <code>&lt;Text&gt;</code>. A custom Vue renderer builds the tree, and
            react-pdf's layout engine and pdfkit turn it into a PDF, in the browser or in Node.
          </p>
          <div class="actions">
            <a class="button button-mint" href="https://vue-pdf-document-docs.vercel.app/getting-started">
              Get started <span aria-hidden="true">›</span>
            </a>
            <button type="button" class="button button-dark" @click="openGenerator">
              Try the invoice generator <span aria-hidden="true">→</span>
            </button>
          </div>
          <div class="install">
            <code><span class="install-prompt" aria-hidden="true">$</span> {{ install }}</code>
            <CopyButton :text="install" label="Copy the install command" />
          </div>
        </div>
        <figure class="hero-code">
          <figcaption>
            <span class="dots" aria-hidden="true"><i /><i /><i /></span>
            HelloDocument.vue
          </figcaption>
          <CodeBlock :code="helloSource" file-name="HelloDocument.vue" />
        </figure>
      </div>
    </section>

    <div id="tabs" class="tabs-bar">
      <div class="container">
        <div class="tabs" role="tablist" aria-label="Demo">
          <button
            v-for="(item, index) in tabs"
            :id="`tab-${item.id}`"
            :key="item.id"
            ref="tabButtons"
            type="button"
            role="tab"
            :aria-selected="tab === item.id"
            :aria-controls="`panel-${item.id}`"
            :tabindex="tab === item.id ? 0 : -1"
            @click="select(item.id)"
            @keydown="onTabKey($event, index)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="tab === 'generator'" id="panel-generator" role="tabpanel" aria-labelledby="tab-generator">
      <section class="band">
        <div class="container container-wide">
          <header class="section-head">
            <p class="tag">Full demo</p>
            <h2>Invoice generator</h2>
            <p>
              A complete invoice built from one template: supplier and customer details, VAT per rate, discounts, an EPC
              payment QR code, your logo, English or Slovak, and a live preview. The draft is saved in this browser;
              export it as JSON to keep it.
            </p>
          </header>
          <InvoiceGenerator />
        </div>
      </section>
    </div>

    <div v-else id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <section class="band">
        <div class="container">
          <ExamplesSection />
        </div>
      </section>

      <section class="band band-mist" aria-labelledby="demos-title">
        <div class="container">
          <header class="section-head">
            <p class="tag">Patterns</p>
            <h2 id="demos-title">More ways to use it</h2>
          </header>
          <div class="demos">
            <section id="demo-headless" class="card demo">
              <header>
                <h3>Headless with usePdf()</h3>
                <p>
                  The composable gives you <code>blob</code>, <code>url</code>, <code>loading</code> and
                  <code>error</code>, and leaves the markup to you. Here the file goes into an
                  <code>&lt;object&gt;</code>.
                </p>
              </header>
              <HeadlessDemo />
            </section>
            <section id="demo-on-demand" class="card demo">
              <header>
                <h3>On demand</h3>
                <p>
                  <code>renderToBlob()</code> behind a button, with the library and the document loaded by dynamic
                  <code>import()</code> only when someone asks for the file. Below it, a
                  <code>&lt;PdfDownloadLink lazy&gt;</code> that renders only once it's hovered, focused or clicked.
                </p>
              </header>
              <OnDemandDemo />
            </section>
          </div>
        </div>
      </section>

      <section class="band" aria-labelledby="engine-title">
        <div class="container split-60">
          <header class="section-head">
            <p class="tag">Under the hood</p>
            <h2 id="engine-title">React's PDF engine, without React</h2>
            <p>
              Only <code>@react-pdf/renderer</code> depends on React. The layout engine, with Yoga flexbox, text shaping
              and pagination, works on a plain tree of nodes. A custom renderer from Vue's
              <code>createRenderer</code> builds that tree from your components, so templates, slots,
              <code>v-for</code> and reactivity work as usual.
            </p>
          </header>
          <ul class="stats">
            <li class="card stat">
              <span class="tag">Library code</span>
              <strong>3.5 kB</strong>
              <span>gzipped, on top of the layout engine</span>
            </li>
            <li class="card stat">
              <span class="tag">One entry</span>
              <strong>Browser + Node</strong>
              <span>the same imports in apps, workers and servers</span>
            </li>
            <li class="card stat">
              <span class="tag">Tested in</span>
              <strong>3 engines</strong>
              <span>Chromium, Firefox and WebKit, end to end</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </main>

  <footer class="footer">
    <div class="container footer-grid">
      <div>
        <h2>vue-pdf-document</h2>
        <p>MIT licensed. Layout and rendering by react-pdf and pdfkit.</p>
      </div>
      <nav aria-label="Project links">
        <h2>Project</h2>
        <a href="https://vue-pdf-document-docs.vercel.app">Docs</a>
        <a href="https://github.com/jantursky/vue-pdf-document">GitHub</a>
        <a href="https://www.npmjs.com/package/vue-pdf-document">npm</a>
      </nav>
      <nav aria-label="Built on">
        <h2>Built on</h2>
        <a href="https://github.com/diegomura/react-pdf">react-pdf</a>
        <a href="https://github.com/foliojs/pdfkit">pdfkit</a>
        <a href="https://vuejs.org">Vue</a>
      </nav>
    </div>
  </footer>
</template>
