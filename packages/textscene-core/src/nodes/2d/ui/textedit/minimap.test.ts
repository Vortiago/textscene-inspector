/**
 * `textEditMinimapRects` versus the minimap arm of `TextEdit::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/text_edit.cpp:1129-1312`). The expected rects are read from Godot 4.6.3's own frame
 * of a 240x84 TextEdit with 4 px style margins and a 27 px row: the text band ends at 156, so the
 * minimap starts at 158.
 */
import { describe, expect, it } from 'vitest';
import type { Rgba } from '../../../../godot/math/math';
import { textEditMinimapRects } from './minimap';

const FONT: Rgba = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
const CARET: Rgba = { r: 0.95, g: 0.95, b: 0.95, a: 1 };
const CURRENT_LINE: Rgba = { r: 0.25, g: 0.25, b: 0.26, a: 0.8 };

function line(text: string, rowStarts: number[] = [0], spans?: ReturnType<typeof spanOf>[]) {
  return { text, rowStarts, spans };
}

function spanOf(startIndex: number, endIndex: number, color: Rgba) {
  return { startIndex, endIndex, color };
}

function minimap(
  lines: ReturnType<typeof line>[],
  overrides: Partial<Parameters<typeof textEditMinimapRects>[0]> = {}
) {
  return textEditMinimapRects({
    lines,
    sizeWidthPx: 240,
    xMarginEndPx: 156,
    widthPx: 80,
    rtl: false,
    controlHeightPx: 76,
    rowHeightPx: 27,
    firstDrawnParagraphRows: 1,
    wrapWidthPx: 142,
    tabSize: 4,
    indentWrappedLines: false,
    highlightCurrentLine: false,
    editable: true,
    fontColor: FONT,
    caretColor: CARET,
    currentLineColor: CURRENT_LINE,
    ...overrides,
  });
}

const geometry = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => ({ x, y, w, h });

describe('textEditMinimapRects', () => {
  it('draws the view rectangle, then one 2 px bar per character on a 3 px row pitch (:1162, :1285)', () => {
    const rects = minimap([line('one'), line('three'), line('six')]);
    expect(rects.map(geometry)).toEqual([
      { x: 158, y: 0, w: 80, h: 9 },
      { x: 158, y: 0, w: 3, h: 2 },
      { x: 158, y: 3, w: 5, h: 2 },
      { x: 158, y: 6, w: 3, h: 2 },
    ]);
    expect(rects[0]!.color).toEqual({ ...CARET, a: 0.1 });
    expect(rects[1]!.color).toEqual(FONT);
  });

  it('ends a run at a space and skips one column for it (:1296-1302)', () => {
    const rects = minimap([line('ab cd')]).slice(1);
    expect(rects.map(geometry)).toEqual([
      { x: 158, y: 0, w: 2, h: 2 },
      { x: 161, y: 0, w: 2, h: 2 },
    ]);
  });

  it('moves a tab to the next tab stop in columns (:1293-1299)', () => {
    const rects = minimap([line('a\tb')]).slice(1);
    expect(rects.map(geometry)).toEqual([
      { x: 158, y: 0, w: 1, h: 2 },
      { x: 162, y: 0, w: 1, h: 2 },
    ]);
  });

  it('stops a run where the minimap ends (:1274-1276)', () => {
    const rects = minimap([line('x'.repeat(200))]).slice(1);
    expect(rects.map(geometry)).toEqual([{ x: 158, y: 0, w: 78, h: 2 }]);
  });

  it('splits a run at a colour change and dims a highlighted colour to 0.6 alpha (:1255-1262)', () => {
    const keyword: Rgba = { r: 1, g: 0.4, b: 0.5, a: 1 };
    const rects = minimap([line('ifx', [0], [spanOf(0, 2, keyword), spanOf(2, 3, FONT)])]).slice(1);
    expect(rects.map((rect) => [rect.x, rect.w, rect.color.a])).toEqual([
      [158, 2, 0.6],
      [160, 1, 0.6],
    ]);
    expect(rects[0]!.color).toMatchObject({ r: 1, g: 0.4, b: 0.5 });
  });

  it('dims a read-only highlighted colour from the read-only alpha (:1257-1259)', () => {
    const readOnly: Rgba = { ...FONT, a: 0.5 };
    const rects = minimap([line('ab', [0], [spanOf(0, 2, FONT)])], {
      editable: false,
      fontColor: readOnly,
    }).slice(1);
    expect(rects[0]!.color.a).toBeCloseTo(0.3);
  });

  it('fills the current line with its band, 2 px high, before its bars (:1225-1227)', () => {
    const rects = minimap([line('one'), line('two')], { highlightCurrentLine: true }).slice(1);
    expect(rects.map(geometry)).toEqual([
      { x: 158, y: 0, w: 80, h: 2 },
      { x: 158, y: 0, w: 3, h: 2 },
      { x: 158, y: 3, w: 3, h: 2 },
    ]);
    expect(rects[0]!.color).toEqual(CURRENT_LINE);
  });

  it('mirrors every rect about the control width under RTL (:1285)', () => {
    const rects = minimap([line('one')], { rtl: true });
    expect(rects.map(geometry)).toEqual([
      { x: 2, y: 0, w: 80, h: 9 },
      { x: 79, y: 0, w: 3, h: 2 },
    ]);
  });

  it('gives each wrapped row its own 3 px slot and steps a wrapped row in by the indent (:1206-1220)', () => {
    const rects = minimap([line('  abcdef', [0, 5])], { indentWrappedLines: true }).slice(1);
    expect(rects.map(geometry)).toEqual([
      { x: 160, y: 0, w: 3, h: 2 },
      { x: 160, y: 3, w: 3, h: 2 },
    ]);
  });

  it('adds the wrapped rows of the first paragraph to the view rectangle height (:1127)', () => {
    const [viewRect] = minimap([line('')], { firstDrawnParagraphRows: 3 });
    expect(geometry(viewRect!)).toEqual({ x: 158, y: 0, w: 80, h: 15 });
  });

  it('draws no more rows than fit 3 px pitch in the control height (:1147)', () => {
    const lines = Array.from({ length: 40 }, () => line('a'));
    const rects = minimap(lines, { controlHeightPx: 30 }).slice(1);
    expect(rects).toHaveLength(10);
  });
});
