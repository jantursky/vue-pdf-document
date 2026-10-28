import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { Document, Page, PageNumber, renderToBuffer, Table, TableCell, TableHeader, TableRow, View } from '../../src'
import { layoutBoxes, pageCount, pdfText } from '../fixtures'

const doc = (page: () => unknown, size: [number, number] | string = [500, 300], padding = 0) =>
  defineComponent(() => () => h(Document, null, () => h(Page, { size, style: { padding } } as never, page as never)))

const row = (...cells: string[]) => h(TableRow, null, () => cells.map((cell) => h(TableCell, null, () => cell)))

describe('PageNumber', () => {
  const pages = () => [
    h(View, { style: { height: 250 } }),
    h(View, { style: { height: 250 } }),
    h(View, { style: { height: 250 } }),
  ]

  it('shows "1 / 3" to "3 / 3" by default', async () => {
    const bytes = await renderToBuffer(doc(() => [...pages(), h(PageNumber)]))
    expect(pageCount(bytes)).toBe(3)
    expect(pdfText(bytes)).toEqual(expect.arrayContaining(['1 / 3', '2 / 3', '3 / 3']))
  })

  it('fills a custom format', async () => {
    const bytes = await renderToBuffer(
      doc(() => [
        h(View, { style: { height: 250 } }),
        h(View, { style: { height: 250 } }),
        h(PageNumber, { format: 'Page {page} of {total}' }),
      ]),
    )
    expect(pdfText(bytes)).toContain('Page 2 of 2')
  })

  it('renders the default slot with the page info', async () => {
    const bytes = await renderToBuffer(
      doc(() => [
        h(PageNumber, null, {
          default: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `p${pageNumber}/${totalPages}`,
        }),
      ]),
    )
    expect(pdfText(bytes)).toContain('p1/1')
  })

  it('passes Text props through', async () => {
    const boxes = await layoutBoxes(doc(() => h(PageNumber, { style: { width: 80, fontSize: 20 } })))
    expect(boxes.find((box) => box.type === 'TEXT')?.width).toBe(80)
  })
})

describe('Table', () => {
  it('sizes cells from mixed column widths', async () => {
    const boxes = await layoutBoxes(
      doc(() => h(Table, { columns: [100, '20%', 'auto', 'auto'] }, () => row('a', 'b', 'c', 'd'))),
    )
    const cells = boxes.filter((box) => box.type === 'VIEW' && box.height > 0 && box.width < 500)
    expect(cells.map((cell) => cell.width)).toEqual([100, 100, 150, 150])
  })

  it('leaves the rest empty in a short row', async () => {
    const boxes = await layoutBoxes(doc(() => h(Table, { columns: [100, 100, 100] }, () => row('a', 'b'))))
    expect(boxes.filter((box) => box.type === 'TEXT')).toHaveLength(2)
  })

  it('places a cell by its explicit column', async () => {
    const boxes = await layoutBoxes(
      doc(() =>
        h(Table, { columns: [100, 200] }, () => h(TableRow, null, () => h(TableCell, { column: 1 }, () => 'x'))),
      ),
    )
    expect(boxes.find((box) => box.type === 'VIEW' && box.width === 200)).toBeDefined()
  })

  it('aligns cell text', async () => {
    const align = async (value: 'left' | 'right') => {
      const boxes = await layoutBoxes(
        doc(() =>
          h(Table, { columns: [200] }, () => h(TableRow, null, () => h(TableCell, { align: value }, () => 'x'))),
        ),
      )
      return boxes.find((box) => box.type === 'TEXT')!.align
    }
    expect(await align('right')).toBe('right')
    expect(await align('left')).toBe('left')
  })

  describe('with 80 rows', () => {
    const table = (repeat?: boolean) =>
      doc(
        () =>
          h(Table, { columns: ['auto'] }, () => [
            h(TableHeader, repeat === undefined ? null : { repeat }, () => row('Name')),
            ...Array.from({ length: 80 }, (_, index) => row(`Row ${index}`)),
          ]),
        [500, 1300],
      )

    it('repeats the header above the first row of each page', async () => {
      const boxes = await layoutBoxes(table())
      const pages = new Set(boxes.map((box) => box.page))
      expect(pages).toEqual(new Set([1, 2]))
      for (const page of pages) {
        const texts = boxes.filter((box) => box.page === page && box.type === 'TEXT')
        const header = texts.find((box) => box.text === 'Name')!
        expect(header, `header on page ${page}`).toBeDefined()
        const firstRow = texts.filter((box) => box.text !== 'Name').sort((a, b) => a.y - b.y)[0]!
        expect(header.y).toBeLessThan(firstRow.y)
      }
    })

    it('draws the header on the first page only with repeat off', async () => {
      const boxes = await layoutBoxes(table(false))
      expect(boxes.filter((box) => box.text === 'Name').map((box) => box.page)).toEqual([1])
    })
  })

  it('moves a row near the bottom margin to the next page whole', async () => {
    const tall = h(TableRow, null, () => h(TableCell, null, () => 'one\ntwo'))
    const boxes = await layoutBoxes(
      doc(() => [h(View, { style: { height: 275 } }), h(Table, { columns: ['auto'] }, () => tall)]),
    )
    const text = boxes.find((box) => box.text?.includes('one'))!
    expect(text.page).toBe(2)
    expect(text.y).toBe(4)
  })

  it('splits a row across pages with wrap', async () => {
    const content = Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n')
    const make = (wrap: boolean) =>
      doc(() => h(Table, { columns: ['auto'] }, () => h(TableRow, { wrap }, () => h(TableCell, null, () => content))))
    const pagesOf = async (wrap: boolean) =>
      new Set((await layoutBoxes(make(wrap))).filter((box) => box.text).map((box) => box.page))
    expect((await pagesOf(true)).size).toBeGreaterThan(1)
  })

  it('stripes every second body row', async () => {
    const boxes = await layoutBoxes(
      doc(() =>
        h(Table, { columns: ['auto'], striped: true }, () => [
          h(TableHeader, null, () => row('Head')),
          ...[1, 2, 3, 4].map((n) => row(`r${n}`)),
        ]),
      ),
    )
    const rows = boxes.filter(
      (box) => box.type === 'VIEW' && box.height > 0 && box.width === 500 && box.y > 0 && box.y < 200,
    )
    const filled = rows.filter((box) => box.fill)
    expect(filled).toHaveLength(2)
  })

  it('merges a user style after the defaults', async () => {
    const boxes = await layoutBoxes(
      doc(() =>
        h(Table, { columns: [100] }, () => h(TableRow, null, () => h(TableCell, { style: { width: 60 } }, () => 'x'))),
      ),
    )
    expect(boxes.some((box) => box.type === 'VIEW' && box.width === 60)).toBe(true)
  })

  it('draws borders as a width or an object', async () => {
    const withBorder = await renderToBuffer(
      doc(() =>
        h(Table, { columns: [100, 100], border: { width: 2, color: '#f00' } }, () => [row('a', 'b'), row('c', 'd')]),
      ),
    )
    const plain = await renderToBuffer(
      doc(() => h(Table, { columns: [100, 100] }, () => [row('a', 'b'), row('c', 'd')])),
    )
    const numeric = await renderToBuffer(
      doc(() => h(Table, { columns: [100, 100], border: 1 }, () => [row('a', 'b'), row('c', 'd')])),
    )
    expect(withBorder.length).toBeGreaterThan(plain.length)
    expect(numeric.length).toBeGreaterThan(plain.length)
  })

  it('follows rows and cells added with v-for and v-if', async () => {
    const show = Boolean(0)
    const boxes = await layoutBoxes(
      doc(() =>
        h(Table, { columns: [100, 200], striped: true }, () => [
          [1, 2, 3].map((n) => row(`r${n}`, `x${n}`)),
          show ? row('hidden') : null,
          h(TableRow, null, () => [show ? h(TableCell, null, () => 'gone') : null, h(TableCell, null, () => 'first')]),
        ]),
      ),
    )
    const cells = boxes.filter((box) => box.type === 'VIEW' && box.width === 100)
    expect(cells).toHaveLength(4)
    expect(boxes.filter((box) => box.fill)).toHaveLength(2)
  })

  it('works without a table around it', async () => {
    const bytes = await renderToBuffer(doc(() => h(TableRow, null, () => h(TableCell, null, () => 'solo'))))
    expect(pdfText(bytes)).toContain('solo')
  })
})
