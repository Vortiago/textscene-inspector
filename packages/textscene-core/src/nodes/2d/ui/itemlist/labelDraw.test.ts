import { describe, expect, it } from 'vitest';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { isItemListLabelFillDrawn, itemListDrawnLabel } from './labelDraw';

/** The x shift of one glyph-less line of `lineWidthPx`, which no clip can cut. */
function itemListLineShiftPx(
  lineWidthPx: number,
  boxWidthPx: number,
  wrapped: boolean,
  rtl: boolean
): number {
  const layout = { lines: [{ widthPx: lineWidthPx, glyphs: [] }] } as unknown as TextLayoutResult;
  return itemListDrawnLabel(layout, boxWidthPx, wrapped, rtl)[0]!.shiftPx;
}

/**
 * `TextParagraph::draw`'s per-line shift (`text_paragraph.cpp:888-921`): CENTER for a wrapped label,
 * RIGHT for an RTL single line, LEFT (no shift) otherwise, each only while the box has a width.
 */
describe('itemListLineShiftPx', () => {
  it('centres a wrapped line, flooring the half (CENTER)', () => {
    expect(itemListLineShiftPx(20, 50, true, false)).toBe(15);
    expect(itemListLineShiftPx(20, 51, true, false)).toBe(15);
  });
  it('leaves a wrapped line wider than its box at the origin under LTR', () => {
    expect(itemListLineShiftPx(80, 50, true, false)).toBe(0);
  });
  it('pulls a wrapped line wider than its box to the trailing edge under RTL', () => {
    expect(itemListLineShiftPx(80, 50, true, true)).toBe(-30);
  });
  it('does not shift a single line under LTR (LEFT)', () => {
    expect(itemListLineShiftPx(30, 78, false, false)).toBe(0);
  });
  it('pushes a short single line to the right edge of its box under RTL (RIGHT)', () => {
    expect(itemListLineShiftPx(30, 78, false, true)).toBe(48);
  });
  it('goes negative for a single line wider than its box under RTL, as the engine does', () => {
    expect(itemListLineShiftPx(78, 30, false, true)).toBe(-48);
  });
  it('is zero for a box of zero or negative width', () => {
    expect(itemListLineShiftPx(30, 0, false, true)).toBe(0);
    expect(itemListLineShiftPx(30, -4, true, false)).toBe(0);
  });
});

// item_list.cpp:1676-1688: a LEFT-mode row draws its fill only when the text keeps room past the
// icon. The outline above it draws regardless (:1672-1674).
describe('isItemListLabelFillDrawn', () => {
  const ROW = { wrapped: false, iconWidthPx: 16, hSeparation: 4, itemRectWidthPx: 120, contentWidthPx: 200 };

  it('draws the fill of a fixed column wider than the icon and separation', () => {
    expect(isItemListLabelFillDrawn({ ...ROW, fixedColumnWidth: 120, wraparoundItems: true })).toBe(true);
  });

  it('hides the fill of a fixed column no wider than the icon and separation', () => {
    const narrow = { ...ROW, itemRectWidthPx: 20, fixedColumnWidth: 20, wraparoundItems: true };
    expect(isItemListLabelFillDrawn(narrow)).toBe(false);
  });

  it('hides the fill of a wraparound list no wider than the icon and separation', () => {
    const narrow = { ...ROW, contentWidthPx: 20, fixedColumnWidth: 0, wraparoundItems: true };
    expect(isItemListLabelFillDrawn(narrow)).toBe(false);
  });

  it('draws the fill of a list without wraparound at any width', () => {
    const empty = { ...ROW, contentWidthPx: 0, fixedColumnWidth: 0, wraparoundItems: false };
    expect(isItemListLabelFillDrawn(empty)).toBe(true);
  });
});
