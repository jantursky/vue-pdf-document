<script setup lang="ts">
import ExampleCard from './ExampleCard.vue'
import HelloDocument from './HelloDocument.vue?raw'
import InvoiceDocument from './InvoiceDocument.vue?raw'
import InvoiceExample from './InvoiceExample.vue'
import invoiceSource from './InvoiceExample.vue?raw'
import MinimalExample from './MinimalExample.vue'
import minimalSource from './MinimalExample.vue?raw'
import ReportDocument from './ReportDocument.vue?raw'
import ReportExample from './ReportExample.vue'
import reportSource from './ReportExample.vue?raw'
</script>

<template>
  <section class="examples" aria-labelledby="examples-title">
    <header class="section-head examples-head">
      <p class="tag">Examples</p>
      <h2 id="examples-title">Three documents, live</h2>
      <p>
        Each example is a document component plus the page that shows it. Open <em>View source</em> to read the exact
        files that run here.
      </p>
      <nav class="chips" aria-label="Examples">
        <a href="#example-minimal">Minimal</a>
        <a href="#example-invoice">Invoice</a>
        <a href="#example-report">Report</a>
      </nav>
    </header>

    <div class="examples-grid">
      <ExampleCard
        id="example-minimal"
        title="Minimal"
        :files="[
          { name: 'HelloDocument.vue', code: HelloDocument },
          { name: 'MinimalExample.vue', code: minimalSource },
        ]"
      >
        <template #description>
          <p>One page and a prop. Type a name and the preview renders again.</p>
        </template>
        <MinimalExample />
      </ExampleCard>

      <ExampleCard
        id="example-invoice"
        title="Invoice"
        :files="[
          { name: 'InvoiceDocument.vue', code: InvoiceDocument },
          { name: 'InvoiceExample.vue', code: invoiceSource },
        ]"
      >
        <template #description>
          <p>
            A reactive form drives the document: <code>v-for</code> rows, a <code>v-if</code> stamp, a computed total
            and <code>&lt;PdfDownloadLink&gt;</code>.
          </p>
        </template>
        <InvoiceExample />
      </ExampleCard>

      <ExampleCard
        id="example-report"
        title="Report"
        :files="[
          { name: 'ReportDocument.vue', code: ReportDocument },
          { name: 'ReportExample.vue', code: reportSource },
        ]"
      >
        <template #description>
          <p>
            Long content split across pages, a <code>fixed</code> header and footer, and page numbers from the
            <code>#render</code> slot.
          </p>
        </template>
        <ReportExample />
      </ExampleCard>
    </div>
  </section>
</template>
