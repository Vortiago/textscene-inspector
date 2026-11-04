import { describe, expect, it } from 'vitest';
import { itemListLineShiftPx } from './labelDraw';

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

/**
 * `max_column_width` is the widest minimum width before `h_separation` joins it (`item_list.cpp:1786-1790`),
 * and `same_column_width` adds the separation once (`:1826`).
 */
