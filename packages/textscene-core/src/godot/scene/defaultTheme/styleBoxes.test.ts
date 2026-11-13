import { describe, expect, it } from 'vitest';
import { flatCornerDetail, makeEmptyStyleBox } from './styleBoxes.js';

describe('flatCornerDetail', () => {
  // Rows are the radius before the theme scale; columns the scales 0.5, 1, 1.5, 2, 4.
  // Expected values are the table of `MIN(ceil(1.5 * radius), 6) * scale` truncated, clamped to 1..20.
  const SCALES = [0.5, 1, 1.5, 2, 4];
  it.each([
    [0, [1, 1, 1, 1, 1]],
    [2, [1, 3, 4, 6, 12]],
    [3, [2, 5, 7, 10, 20]],
    [4, [3, 6, 9, 12, 20]],
    [6, [3, 6, 9, 12, 20]],
    [10, [3, 6, 9, 12, 20]],
  ])('gives the Godot detail for radius %i', (radius, expected) => {
    expect(SCALES.map((scale) => flatCornerDetail(radius, scale))).toEqual(expected);
  });
});

describe('makeEmptyStyleBox', () => {
  it('rounds an unset margin of -1 away from zero, as Math::round does: SpinBox reads -2 at scale 1.5', () => {
    expect(makeEmptyStyleBox(1.5)).toEqual({
      kind: 'empty',
      contentMargin: { left: -2, top: -2, right: -2, bottom: -2 },
    });
  });
});
