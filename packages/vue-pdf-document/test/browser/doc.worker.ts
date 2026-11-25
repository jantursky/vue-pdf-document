import { defineComponent, h } from 'vue'

import { Document, Page, Text } from '../../src'
import { exposeDocuments } from '../../src/worker'

const Doc = defineComponent({
  props: { sections: { type: Number, default: 1 } },
  setup: (props) => () =>
    h(Document, null, () =>
      h(Page, null, () =>
        Array.from({ length: props.sections }, (_, index) => h(Text, null, () => `Section ${index}`)),
      ),
    ),
})

export const documents = exposeDocuments({ doc: Doc })
