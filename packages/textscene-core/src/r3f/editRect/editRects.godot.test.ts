import { describe, expect, it } from 'vitest';
import type { Rect2 } from '../../godot/math/rect2';
import { sprite2DEditRect } from '../../nodes/2d/sprite2d/editRect';
import { pointLight2DEditRect } from '../../nodes/2d/pointlight2d/editRect';
import { line2DEditRect } from '../../nodes/2d/line2d/editRect';
import { polygon2DEditRect } from '../../nodes/2d/polygon2d/editRect';
import { path2DEditRect } from '../../nodes/2d/path2d/editRect';
import { backBufferCopyEditRect } from '../../nodes/2d/backbuffercopy/editRect';
import { visibleOnScreenNotifier2DEditRect } from '../../nodes/2d/visibleonscreennotifier2d/editRect';
import { collisionPolygon2DEditRect } from '../../nodes/physics/2d/collisionpolygon2d/editRect';

// Each expected rect is what Godot 4.6.3 printed for `_edit_get_rect()` on the same node, headless.
const rect = (x: number, y: number, w: number, h: number): Rect2 => ({ x, y, w, h });
const SPRITE = {
  centered: true,
  offset: { x: 0, y: 0 },
  region_enabled: false,
  hframes: 1,
  vframes: 1,
  frame: 0,
};
const T64 = { width: 64, height: 32 };
const T100 = { width: 100, height: 50 };
const points = (...xy: number[]) => new Float32Array(xy);
const ZERO = { x: 0, y: 0 };

const ROWS: readonly [string, () => Rect2 | null, Rect2 | null][] = [
  ['Sprite2D with no texture', () => sprite2DEditRect(undefined, SPRITE), null],
  ['Sprite2D 64x32 centred', () => sprite2DEditRect(T64, SPRITE), rect(-32, -16, 64, 32)],
  [
    'Sprite2D 3x2 frames, offset, not centred',
    () =>
      sprite2DEditRect(T100, { ...SPRITE, centered: false, offset: { x: 5, y: -3 }, hframes: 3, vframes: 2 }),
    rect(5, -3, 33, 25),
  ],
  [
    'Sprite2D region',
    () =>
      sprite2DEditRect(T100, {
        ...SPRITE,
        region_enabled: true,
        region_rect: { x: 4, y: 4, width: 20, height: 10 },
      }),
    rect(-10, -5, 20, 10),
  ],
  [
    'Sprite2D 7x3 frames, fractional offset',
    () => sprite2DEditRect(T100, { ...SPRITE, hframes: 7, vframes: 3, offset: { x: -2.5, y: 1.25 } }),
    rect(-9.5, -6.75, 14, 16),
  ],
  ['PointLight2D scale 2', () => pointLight2DEditRect(T64, 2, { x: 10, y: 0 }), rect(-54, -32, 128, 64)],
  ['PointLight2D scale 0.5', () => pointLight2DEditRect(T64, 0.5, { x: -3, y: 7 }), rect(-19, -1, 32, 16)],
  ['Line2D with no points', () => line2DEditRect(points(), 10), rect(0, 0, 0, 0)],
  ['Line2D width 10', () => line2DEditRect(points(0, 0, 100, 40), 10), rect(-10, -10, 120, 60)],
  ['Line2D width 2.5', () => line2DEditRect(points(-5, 3, 7, -9, 1, 1), 2.5), rect(-7.5, -11.5, 17, 17)],
  ['Polygon2D with no points', () => polygon2DEditRect(points(), ZERO), null],
  ['Polygon2D', () => polygon2DEditRect(points(0, 0, 30, 10, 10, 20), { x: 5, y: 5 }), rect(5, 5, 30, 20)],
  ['CollisionPolygon2D with no points', () => collisionPolygon2DEditRect({}), rect(-10, -10, 20, 20)],
  [
    'CollisionPolygon2D',
    () => collisionPolygon2DEditRect({ polygon: 'PackedVector2Array(0, 0, 100, 0, 100, 50)' }),
    rect(-30, -15, 160, 80),
  ],
  ['BackBufferCopy default', () => backBufferCopyEditRect({}), rect(-100, -100, 200, 200)],
  ['BackBufferCopy', () => backBufferCopyEditRect({ rect: 'Rect2(1, 2, 3, 4)' }), rect(1, 2, 3, 4)],
  ['VisibleOnScreenNotifier2D', () => visibleOnScreenNotifier2DEditRect({}), rect(-10, -10, 20, 20)],
  [
    'VisibleOnScreenNotifier2D with show_rect off',
    () => visibleOnScreenNotifier2DEditRect({ show_rect: 'false' }),
    null,
  ],
  [
    'Path2D with an out handle',
    () =>
      path2DEditRect([
        { position: ZERO, in: ZERO, out: { x: 0, y: 80 } },
        { position: { x: 100, y: 0 }, in: ZERO, out: ZERO },
      ]),
    rect(0, 0, 100, 35.15625),
  ],
];

describe('edit rects against Godot 4.6.3', () => {
  it.each(ROWS)('%s', (_name, ours, godot) => {
    const found = ours();
    if (godot === null) {
      expect(found).toBeNull();
      return;
    }
    expect(found).not.toBeNull();
    expect(found!.x).toBeCloseTo(godot.x, 4);
    expect(found!.y).toBeCloseTo(godot.y, 4);
    expect(found!.w).toBeCloseTo(godot.w, 4);
    expect(found!.h).toBeCloseTo(godot.h, 4);
  });
});
