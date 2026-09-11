/**
 * `separatorLineDrawRect` — `scene/gui/separator.cpp:47-60` composed with
 * `scene/resources/style_box_line.cpp:86-100` (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { StyleBoxLineData } from './styleBoxLine';
import { separatorLineDrawRect } from './styleBoxLineGeometry';

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

describe('separatorLineDrawRect', () => {
  it('HSeparator: a thin horizontal band centred on the cross axis, grown 1px past each end (default theme)', () => {
    // separator.cpp:52,55-56: (size.y - ssize.y)/2 int-divides `25/2` → 12, not 12.5.
    const draw = separatorLineDrawRect('horizontal', { x: 0, y: 0, w: 100, h: 25 }, box());
    expect(draw).toEqual({ x: -1, y: 12, w: 102, h: 1 });
  });

  it('VSeparator: a thin vertical band centred on the cross axis, grown 1px past each end (default theme)', () => {
    const vBox = box({ vertical: true, margin: { left: 0, top: 4, right: 0, bottom: 4 } });
    const draw = separatorLineDrawRect('vertical', { x: 0, y: 0, w: 25, h: 100 }, vBox);
    expect(draw).toEqual({ x: 12, y: -1, w: 1, h: 102 });
  });

  it('int-divides toward zero, not floor, when the margin sum exceeds the rect (a large custom thickness on a small rect)', () => {
    // get_style_margin(top/bottom) = thickness/2 = 10 each; ssize.y = 20 > rect.h = 5.
    // (5 - 20) / 2 truncates to -7 in C++; Math.floor would give -8.
    const wide = box({ thickness: 20, margin: { left: 0, top: 10, right: 0, bottom: 10 } });
    const draw = separatorLineDrawRect('horizontal', { x: 0, y: 0, w: 50, h: 5 }, wide);
    expect(draw).toEqual({ x: -1, y: -7, w: 52, h: 20 });
  });

  it('grows/thickens along the STYLEBOX’s own `vertical` flag, independent of the Separator’s orientation', () => {
    // An HSeparator (orientation 'horizontal') with a hand-authored StyleBoxLine
    // whose own `vertical` is true: Separator places the rect from ITS axis,
    // StyleBoxLine::draw grows/thickens from ITS OWN flag — style_box_line.cpp:86-100.
    const crossed = box({ vertical: true, thickness: 6, margin: { left: 3, top: 0, right: 3, bottom: 0 } });
    const draw = separatorLineDrawRect('horizontal', { x: 0, y: 0, w: 40, h: 20 }, crossed);
    expect(draw).toEqual({ x: 0, y: 9, w: 6, h: 2 });
  });

  it('zero-size rect: the line collapses to its default-theme margin span with no cross-axis extent', () => {
    const draw = separatorLineDrawRect('horizontal', { x: 0, y: 0, w: 0, h: 0 }, box());
    expect(draw).toEqual({ x: -1, y: 0, w: 2, h: 1 });
  });
});
