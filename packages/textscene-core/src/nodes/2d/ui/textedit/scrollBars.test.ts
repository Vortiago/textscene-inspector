/**
 * `textEditScrollBars` versus `TextEdit::_update_scrollbars` (`scene/gui/text_edit.cpp:8587-8656`).
 * Each expected rect, `max` and `page` is a value read from Godot 4.6.3's own bars at theme scale 1
 * with the default font (line height 27), in a 240x84 box with 4 px style margins.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { scrollBarGrabberGeometry } from '../shared/scrollBarSolver';
import { textEditScrollBars } from './scrollBars';

const theme = nativeTheme(1);
const MARGINS = { left: 4, top: 4, right: 4, bottom: 4 };

function bars(overrides: Partial<Parameters<typeof textEditScrollBars>[0]> = {}) {
  return textEditScrollBars({
    size: { x: 240, y: 84 },
    margins: MARGINS,
    rowHeightPx: 27,
    totalRows: 6,
    widestRowPx: 40,
    gutterBandWidthPx: 0,
    minimapWidthPx: 0,
    scrollPastEndOfFile: false,
    fitContentHeight: false,
    rtl: false,
    theme,
    ...overrides,
  });
}

/** The grabber a bar of this `max` and `page` gets, the value-0 end of its travel. */
function grabberOf(isVertical: boolean, lengthPx: number, max: number, page: number) {
  return scrollBarGrabberGeometry(isVertical, lengthPx, theme, 0, max, page, 0);
}

describe('textEditScrollBars: the vertical bar', () => {
  it('shows for six rows in 240x84, at (232, 4, 8, 72) with max 6 and page 2.8148 (:8621-8635)', () => {
    const { vertical } = bars();
    expect(vertical.visible).toBe(true);
    expect(vertical.rect).toEqual({ x: 232, y: 4, w: 8, h: 72 });
    const expected = grabberOf(true, 72, 6, 76 / 27);
    expect(vertical.grabberRect.h).toBeCloseTo(expected.size, 6);
  });

  it('counts a seventh row for max 7 and the same page, as a wrapped first line gives', () => {
    const six = bars().vertical.grabberRect;
    const seven = bars({ totalRows: 7 }).vertical.grabberRect;
    expect(seven.h).toBeCloseTo(grabberOf(true, 72, 7, 76 / 27).size, 6);
    expect(seven.h).toBeLessThan(six.h);
  });

  it('hides for two rows, where total rows equal the 2 visible rows', () => {
    expect(bars({ totalRows: 2 }).vertical.visible).toBe(false);
  });

  it('hides under scroll_fit_content_height whatever the rows (:8621)', () => {
    expect(bars({ fitContentHeight: true }).vertical.visible).toBe(false);
  });

  it('adds visible rows - 1 for scroll_past_end_of_file, so six rows give max 7 (:8602-8605)', () => {
    const past = bars({ scrollPastEndOfFile: true }).vertical.grabberRect;
    expect(past.h).toBeCloseTo(grabberOf(true, 72, 7, 76 / 27).size, 6);
  });

  it('ignores scroll_past_end_of_file under scroll_fit_content_height', () => {
    expect(bars({ scrollPastEndOfFile: true, fitContentHeight: true, totalRows: 2 }).vertical.visible).toBe(
      false
    );
  });
});

describe('textEditScrollBars: the horizontal bar', () => {
  it('shows when the widest row passes 232 px, at (0, 76, 232, 8) with page 232 (:8637-8653)', () => {
    const { horizontal } = bars({ totalRows: 2, widestRowPx: 400 });
    expect(horizontal.visible).toBe(true);
    expect(horizontal.rect).toEqual({ x: 0, y: 76, w: 232, h: 8 });
    expect(horizontal.grabberRect.w).toBeCloseTo(grabberOf(false, 232, 400, 232).size, 6);
  });

  it('hides when the widest row fits, and keeps the corner term in its rect', () => {
    const { horizontal } = bars({ totalRows: 2 });
    expect(horizontal.visible).toBe(false);
    expect(horizontal.rect.w).toBe(232);
  });

  it('counts the gutter band and the minimap against the width (:8607-8612)', () => {
    expect(bars({ totalRows: 2, widestRowPx: 150, gutterBandWidthPx: 80 }).horizontal.visible).toBe(false);
    expect(
      bars({ totalRows: 2, widestRowPx: 150, gutterBandWidthPx: 80, minimapWidthPx: 10 }).horizontal.visible
    ).toBe(true);
  });

  it('lowers the visible rows by its own height (:8658-8664): 90 px shows three rows, 82 px with the bar shows two', () => {
    const tall = { size: { x: 240, y: 90 }, totalRows: 3 };
    expect(bars({ ...tall, widestRowPx: 40 }).vertical.visible).toBe(false);
    expect(bars({ ...tall, widestRowPx: 400 }).vertical.visible).toBe(true);
  });
});

describe('textEditScrollBars: a right-to-left layout', () => {
  // `Control::_size_changed` mirrors each child about the parent's width (`control.cpp:1785-1787`),
  // and `scroll_bar.cpp` never reads the layout direction, so each bar moves whole.
  it('puts the vertical bar at the left edge', () => {
    expect(bars({ rtl: true }).vertical.rect).toEqual({ x: 0, y: 4, w: 8, h: 72 });
  });

  it('shifts the horizontal bar right by the vertical bar width', () => {
    const { horizontal } = bars({ totalRows: 2, widestRowPx: 400, rtl: true });
    expect(horizontal.rect).toEqual({ x: 8, y: 76, w: 232, h: 8 });
  });

  it('keeps each grabber at value 0 of its own bar', () => {
    const ltr = bars({ widestRowPx: 400 });
    const rtl = bars({ widestRowPx: 400, rtl: true });
    expect(rtl.vertical.grabberRect).toEqual(ltr.vertical.grabberRect);
    expect(rtl.horizontal.grabberRect).toEqual(ltr.horizontal.grabberRect);
  });
});

describe('textEditScrollBars: the control height', () => {
  it('is the height inside the style margins while no horizontal bar shows', () => {
    expect(bars().controlHeightPx).toBe(76);
  });

  it('loses the horizontal bar height (:8658-8664)', () => {
    expect(bars({ widestRowPx: 400 }).controlHeightPx).toBe(68);
  });
});
