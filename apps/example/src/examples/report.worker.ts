import { exposeDocuments } from 'vue-pdf-document/worker'

import ReportDocument from './ReportDocument.vue'

// Runs in the worker: fonts registered here are the ones the worker lays out with.
export const documents = exposeDocuments({ report: ReportDocument })
