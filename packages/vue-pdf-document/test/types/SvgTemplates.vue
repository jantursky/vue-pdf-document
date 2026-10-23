<!--
  Template type checks for the SVG and Canvas primitives, compiled by `bun run typecheck`
  through the tsconfig.json next to it, which turns on `checkUnknownProps`. Not rendered.
  The valid markup must compile, and each `@vue-expect-error` must catch an error.
-->
<script setup lang="ts">
import { Canvas, Circle, Defs, LinearGradient, Path, Rect, Stop, Svg } from '../../src/components/primitives'
import type { CanvasPainter } from '../../src/components/types'

const paint = (painter: CanvasPainter, width: number, height: number) =>
  painter.save().moveTo(0, 0).lineTo(width, height).lineWidth(2).stroke('#0d9488').restore()
</script>

<template>
  <Svg :width="40" :height="40" view-box="0 0 40 40">
    <Defs>
      <LinearGradient id="fade" x1="0" x2="1">
        <Stop offset="0" stop-color="#0d9488" />
        <Stop offset="1" stop-color="#0d9488" :stop-opacity="0" />
      </LinearGradient>
    </Defs>
    <Rect width="40" height="40" fill="url(#fade)" />
    <Path d="M0 0 L10 10" stroke-width="2" stroke-linecap="round" />

    <!-- @vue-expect-error widht is not an attribute, and width is required -->
    <Rect widht="10" height="10" />
    <!-- @vue-expect-error radius is not an attribute of Circle -->
    <Circle r="4" radius="4" />
    <!-- @vue-expect-error a gradient needs an id to be referenced -->
    <LinearGradient x1="0" />
    <!-- @vue-expect-error stroke-linecap takes butt, round or square -->
    <Path d="M0 0" stroke-linecap="pointy" />
  </Svg>
  <Canvas :paint="paint" :style="{ width: 40, height: 40 }" />
</template>
