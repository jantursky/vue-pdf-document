<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePdf } from 'vue-pdf-document'

import HelloDocument from '../examples/HelloDocument.vue'

const name = ref('Headless')
const { blob, url, loading, error, update } = usePdf(HelloDocument, () => ({ name: name.value }), { debounce: 150 })

// Time each render from the first change to the new blob.
const startedAt = ref(0)
const lastRender = ref<number | null>(null)
watch(loading, (now) => {
  if (now) startedAt.value = performance.now()
  else lastRender.value = Math.round(performance.now() - startedAt.value)
})

const size = computed(() => (blob.value ? `${(blob.value.size / 1024).toFixed(1)} kB` : '–'))
</script>

<template>
  <div class="split">
    <div>
      <label class="field">Name <input v-model="name" /></label>
      <dl class="state">
        <dt>loading</dt>
        <dd data-state="loading">{{ loading }}</dd>
        <dt>size</dt>
        <dd data-state="size">{{ size }}</dd>
        <dt>last render</dt>
        <dd>{{ lastRender === null ? '–' : `${lastRender} ms` }}</dd>
        <dt>error</dt>
        <dd>{{ error ?? 'none' }}</dd>
      </dl>
      <button type="button" class="button" @click="update">Render now</button>
    </div>
    <object v-if="url" class="frame" :data="url" type="application/pdf" aria-label="Headless preview" />
  </div>
</template>
