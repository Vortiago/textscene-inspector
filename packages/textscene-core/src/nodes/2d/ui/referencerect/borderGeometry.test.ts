/**
 * `referenceRectBorderQuads` — `scene/gui/reference_rect.cpp:36-42` composed
 * with `scene/main/canvas_item.cpp:815-841`'s unfilled `draw_rect` (Godot
 * 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import { referenceRectBorderQuads } from './borderGeometry';

describe('referenceRectBorderQuads', () => {
  it('strokes a picture-frame outline centred on the rect edge, corners assigned once (canvas_item.cpp:830-840)', () => {
    const quads = referenceRectBorderQuads(100, 50, 2);
    expect(quads).toEqual([
      { x: -1, y: -1, w: 102, h: 2 },
      { x: -1, y: 49, w: 102, h: 2 },
      { x: -1, y: 1, w: 2, h: 48 },
      { x: 99, y: 1, w: 2, h: 48 },
    ]);
  });

  it('draws a single filled rect grown by half the width when the width reaches the smaller dimension (canvas_item.cpp:827-828)', () => {
    const quads = referenceRectBorderQuads(10, 5, 6);
    expect(quads).toEqual([{ x: -3, y: -3, w: 16, h: 11 }]);
  });

  it('takes the filled branch at the exact boundary (width === the smaller dimension)', () => {
    const quads = referenceRectBorderQuads(20, 4, 4);
    expect(quads).toEqual([{ x: -2, y: -2, w: 24, h: 8 }]);
  });

  it('draws nothing for a non-positive width', () => {
    expect(referenceRectBorderQuads(100, 50, 0)).toEqual([]);
    expect(referenceRectBorderQuads(100, 50, -1)).toEqual([]);
  });
});
