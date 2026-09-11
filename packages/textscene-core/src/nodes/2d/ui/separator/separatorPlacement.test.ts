/**
 * `separatorPlacementRect` — `scene/gui/separator.cpp:47-56` (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { separatorPlacementRect } from './separatorPlacement';

const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function boxWithMargin(margin: StyleBoxFlatData['contentMargin']): StyleBoxFlatData {
  return {
    bgColor: TRANSPARENT,
    borderColor: TRANSPARENT,
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin: margin,
    drawCenter: false,
    borderBlend: false,
    antiAliased: false,
    aaSize: 1,
    cornerDetail: 1,
    skew: { x: 0, y: 0 },
    shadowColor: TRANSPARENT,
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

describe('separatorPlacementRect', () => {
  it('horizontal: centres a band on the Y axis, sized by the style’s along-axis margin sum', () => {
    // separator.cpp:55: Rect2(0, (size.y-ssize.y)/2, size.x, ssize.y). ssize.y = 0 (no top/bottom margin).
    const rect = separatorPlacementRect('horizontal', { x: 0, y: 0, w: 100, h: 25 }, boxWithMargin({ left: 4, top: 0, right: 4, bottom: 0 }));
    expect(rect).toEqual({ x: 0, y: 12, w: 100, h: 0 });
  });

  it('vertical: centres a band on the X axis, sized by the style’s along-axis margin sum', () => {
    // separator.cpp:52: Rect2((size.x-ssize.x)/2, 0, ssize.x, size.y).
    const rect = separatorPlacementRect('vertical', { x: 0, y: 0, w: 25, h: 100 }, boxWithMargin({ left: 0, top: 4, right: 0, bottom: 4 }));
    expect(rect).toEqual({ x: 12, y: 0, w: 0, h: 100 });
  });

  it('int-divides toward zero, not floor, when the margin sum exceeds the rect', () => {
    // (5 - 20) / 2 truncates to -7 in C++; Math.floor would give -8.
    const rect = separatorPlacementRect('horizontal', { x: 0, y: 0, w: 50, h: 5 }, boxWithMargin({ left: 0, top: 10, right: 0, bottom: 10 }));
    expect(rect).toEqual({ x: 0, y: -7, w: 50, h: 20 });
  });

  it('truncates a fractional content margin sum before the divide (StyleBox::get_minimum_size sums as float)', () => {
    // Horizontal placement uses the box's TOP+BOTTOM margin (the cross axis),
    // not left/right — see the "horizontal" case above.
    const rect = separatorPlacementRect('horizontal', { x: 0, y: 0, w: 100, h: 25 }, boxWithMargin({ left: 0, top: 0.5, right: 0, bottom: 0.5 }));
    expect(rect.h).toBe(1);
  });

  it('zero-size rect: the placement collapses to the style’s own margin span', () => {
    const rect = separatorPlacementRect('horizontal', { x: 0, y: 0, w: 0, h: 0 }, boxWithMargin({ left: 4, top: 0, right: 4, bottom: 0 }));
    expect(rect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
