/**
 * Settles TextEdit's wrap width, its shaped rows and its two scroll bars together. The wrap width
 * needs the vertical bar (`text_edit.cpp:8541-8543`) and the bar needs the wrapped rows (`:8602`),
 * so the rows are shaped without the bar first and again beside it where it shows.
 */
import type { Vector2 } from '../../../../godot/math/vector';
import type { ScrollBarPairBoxes } from '../shared/scrollBarSolver';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  shapeTextEditLines,
  textEditRowStats,
  textEditWrapWidthPx,
  type TextEditLineLayout,
  type TextEditShapeOptions,
} from './nativeSolver';
import { textEditScrollBars, type TextEditScrollBars } from './scrollBars';

interface TextEditRowsInput {
  lines: readonly string[];
  isPlaceholder: boolean;
  /** The control's `get_size()`. */
  size: Vector2;
  margins: StyleBoxFlatData['contentMargin'];
  rowHeightPx: number;
  gutterBandWidthPx: number;
  minimapWidthPx: number;
  drawMinimap: boolean | undefined;
  scrollPastEndOfFile: boolean;
  fitContentHeight: boolean;
  rtl: boolean;
  /** Everything the shaping reads, but the wrap width and the placeholder flag. */
  shape: Omit<TextEditShapeOptions, 'wrapWidthPx' | 'placeholder'>;
  scrollBarBoxes: ScrollBarPairBoxes;
}

export interface TextEditRows {
  lineLayouts: TextEditLineLayout[];
  /** The `wrap_at_column` the rows were shaped at. */
  wrapWidthPx: number;
  scrollBars: TextEditScrollBars;
}

export function solveTextEditRows(input: TextEditRowsInput): TextEditRows {
  const wrapWidthFor = (verticalBarWidthPx: number) =>
    textEditWrapWidthPx(
      input.size.x,
      input.margins.left + input.margins.right,
      input.gutterBandWidthPx,
      input.minimapWidthPx,
      input.drawMinimap,
      verticalBarWidthPx
    );
  const shapeAt = (wrapWidthPx: number) =>
    shapeTextEditLines(input.lines, { ...input.shape, wrapWidthPx, placeholder: input.isPlaceholder });
  const rowsAt = (wrapWidthPx: number, lineLayouts: TextEditLineLayout[]) => {
    const { totalRows, widestRowPx } = textEditRowStats(lineLayouts);
    const scrollBars = textEditScrollBars({
      size: input.size,
      margins: input.margins,
      rowHeightPx: input.rowHeightPx,
      totalRows,
      widestRowPx,
      gutterBandWidthPx: input.gutterBandWidthPx,
      minimapWidthPx: input.drawMinimap ? input.minimapWidthPx : 0,
      scrollPastEndOfFile: input.scrollPastEndOfFile,
      fitContentHeight: input.fitContentHeight,
      rtl: input.rtl,
      scrollBarBoxes: input.scrollBarBoxes,
    });
    return { lineLayouts, wrapWidthPx, scrollBars };
  };

  const plainWidthPx = wrapWidthFor(0);
  const withoutBar = rowsAt(plainWidthPx, shapeAt(plainWidthPx));
  const barWidthPx = withoutBar.scrollBars.verticalWidthPx;
  if (barWidthPx === 0) return withoutBar;
  // Without wrapping the width reaches no row, so only the bars need solving again. A narrower wrap
  // never gives fewer rows, so the vertical bar stays visible.
  const narrowedWidthPx = wrapWidthFor(barWidthPx);
  const isWrapping = input.shape.wrapMode === 1;
  return rowsAt(narrowedWidthPx, isWrapping ? shapeAt(narrowedWidthPx) : withoutBar.lineLayouts);
}
