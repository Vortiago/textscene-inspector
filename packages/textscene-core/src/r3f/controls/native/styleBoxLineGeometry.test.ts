/**
 * `styleBoxLineDrawRect` against `scene/resources/style_box_line.cpp:86-100`
 * (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { StyleBoxLineData } from './styleBoxLine';
import { styleBoxLineDrawRect } from './styleBoxLineGeometry';

function box(overrides: Partial<StyleBoxLineData> = {}): StyleBoxLineData {
  return {
    color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    thickness: 1,
    vertical: false,
    growBegin: 1,
    growEnd: 1,
    margin: { left: 4, top: 0, right: 4, bottom: 0 },
    ...overrides,
  };
}

describe('styleBoxLineDrawRect', () => {
  it('horizontal: grows the rect by growBegin/growEnd and pins height to thickness', () => {
    // style_box_line.cpp:94-97: r.position.x -= grow_begin; r.size.x += grow_begin+grow_end; r.size.y = thickness.
    const draw = styleBoxLineDrawRect({ x: 0, y: 12, w: 100, h: 1 }, box());
    expect(draw).toEqual({ x: -1, y: 12, w: 102, h: 1 });
  });

  it('vertical: grows the rect on the Y axis and pins width to thickness', () => {
    // style_box_line.cpp:90-93.
    const vBox = box({ vertical: true });
    const draw = styleBoxLineDrawRect({ x: 12, y: 0, w: 1, h: 100 }, vBox);
    expect(draw).toEqual({ x: 12, y: -1, w: 1, h: 102 });
  });

  it('truncates toward zero, not floor, for a fractional growBegin (a hand-authored non-integer grow)', () => {
    // `r.position.x -= grow_begin` narrows the real_t RHS to int32 before
    // subtracting: Math.trunc(-2.5) = -2, Math.floor would give -3.
    const draw = styleBoxLineDrawRect({ x: 0, y: 0, w: 10, h: 1 }, box({ growBegin: 2.5, growEnd: 0 }));
    expect(draw.x).toBe(-2);
  });

  it('truncates a fractional input rect first (the implicit Rect2→Rect2i conversion)', () => {
    const draw = styleBoxLineDrawRect({ x: 0.7, y: 0.9, w: 10.9, h: 5.2 }, box());
    expect(draw).toEqual({ x: -1, y: 0, w: 12, h: 1 });
  });

  it('a zero-size rect still grows by grow_begin/grow_end (no early return in StyleBoxLine::draw)', () => {
    const draw = styleBoxLineDrawRect({ x: 0, y: 0, w: 0, h: 0 }, box());
    expect(draw).toEqual({ x: -1, y: 0, w: 2, h: 1 });
  });
});
