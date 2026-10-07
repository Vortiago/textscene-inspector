/**
 * Godot's 2D light cull: `renderer_canvas_render_rd.cpp:2369` per item, and `_draw_viewport` in `servers/rendering/renderer_viewport.cpp`
 * (line 1220) per canvas. Godot has no unit test for either (`test_node_2d.cpp` never touches
 * `z_index`), so these are the source lines plus probes.
 */

import { describe, it, expect } from 'vitest';
import { CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN } from '../../godot/rendering';
import {
  DEFAULT_LIGHT_CULL_KEY,
  directionalLightCullKey,
  lightReachesItem,
  type LightCullKey,
} from './lightCullKey';

/** A key with Godot's defaults, overridden field by field. */
function key(overrides: Partial<LightCullKey> = {}): LightCullKey {
  return { ...DEFAULT_LIGHT_CULL_KEY, ...overrides };
}

describe('DEFAULT_LIGHT_CULL_KEY', () => {
  it("is Godot's own default light window", () => {
    // `scene/2d/light_2d.h:50-55`, and confirmed on the engine: a fresh
    // PointLight2D in 4.6.3 reports range_z_min=-1024 range_z_max=1024
    // range_layer_min=0 range_layer_max=0, with both cull masks at 1.
    expect(DEFAULT_LIGHT_CULL_KEY).toEqual({
      itemCullMask: 1,
      zMin: -1024,
      zMax: 1024,
      layerMin: 0,
      layerMax: 0,
    });
  });
});

describe('lightReachesItem', () => {
  it('applies a default light to a default item', () => {
    expect(lightReachesItem(key(), 1, 0, 0)).toBe(true);
  });

  it('culls an item whose light_mask shares no bit with the cull mask', () => {
    // The isometric dungeon's painted shadows: light_mask 512 against torches
    // that left range_item_cull_mask at 1.
    expect(lightReachesItem(key(), 512, 0, 0)).toBe(false);
    expect(lightReachesItem(key({ itemCullMask: 17 }), 128, 0, 0)).toBe(false);
  });

  it('applies on ANY shared bit, not on equality', () => {
    // The dungeon candle's own light: cull 145 = 128 | 16 | 1 over an item at 128.
    expect(lightReachesItem(key({ itemCullMask: 145 }), 128, 0, 0)).toBe(true);
    expect(lightReachesItem(key({ itemCullMask: 3 }), 2, 0, 0)).toBe(true);
  });

  it('lets light_mask 0 be reached by nothing, whatever the light asks for', () => {
    expect(lightReachesItem(key({ itemCullMask: 0xffffffff }), 0, 0, 0)).toBe(false);
  });

  it('compares the full 32 bits, including the sign bit', () => {
    // 2147483648 is bit 32; a signed-int shortcut that dropped it would report
    // no intersection here.
    expect(lightReachesItem(key({ itemCullMask: 2147483648 }), 2147483648, 0, 0)).toBe(true);
    expect(lightReachesItem(key({ itemCullMask: 2147483648 }), 1, 0, 0)).toBe(false);
  });

  it('holds the z window at both ends, inclusively', () => {
    // Godot 4.6.3, `unit-pointlight2d-range-z.tscn`: `range_z_max = 4` lights the z_index-4 panel,
    // rgb(213, 173, 165), and withholds z_index 5, rgb(55, 62, 106) = albedo × CanvasModulate.
    // `range_z_min = 4` lights z_index 4 and withholds z_index 0.
    const window = key({ zMin: -2, zMax: 4 });
    expect(lightReachesItem(window, 1, -2, 0)).toBe(true);
    expect(lightReachesItem(window, 1, 0, 0)).toBe(true);
    expect(lightReachesItem(window, 1, 4, 0)).toBe(true);
    expect(lightReachesItem(window, 1, -3, 0)).toBe(false);
    expect(lightReachesItem(window, 1, 5, 0)).toBe(false);
  });

  it('still excludes an item past the DEFAULT window, wide as it is', () => {
    // -1024..1024 goes unnoticed while z stays small, but the bound is real. A `.tscn` may author
    // `z_index = 5000` or accumulate past it: `z_index`'s -4096..4096 is a PROPERTY_HINT_RANGE, not
    // a setter guard.
    expect(lightReachesItem(key(), 1, -1024, 0)).toBe(true);
    expect(lightReachesItem(key(), 1, 1024, 0)).toBe(true);
    expect(lightReachesItem(key(), 1, 1025, 0)).toBe(false);
    expect(lightReachesItem(key(), 1, -1025, 0)).toBe(false);
  });

  it('holds the layer window at both ends, inclusively', () => {
    const window = key({ layerMin: -1, layerMax: 2 });
    expect(lightReachesItem(window, 1, 0, -1)).toBe(true);
    expect(lightReachesItem(window, 1, 0, 2)).toBe(true);
    expect(lightReachesItem(window, 1, 0, -2)).toBe(false);
    expect(lightReachesItem(window, 1, 0, 3)).toBe(false);
  });

  it('withholds a default light from a default CanvasLayer', () => {
    // Measured: a default light over a Polygon2D inside a bare CanvasLayer
    // leaves it at its raw albedo, rgb(107, 107, 117) for Color(0.42, 0.42, 0.46).
    // CanvasLayer.layer defaults to 1 and the light's window is 0..0.
    expect(lightReachesItem(key(), 1, 0, 1)).toBe(false);
    // The same scene with range_layer_max = 1 lights it, rgb(164, 147, 139).
    expect(lightReachesItem(key({ layerMax: 1 }), 1, 0, 1)).toBe(true);
  });

  it('needs every clause, not just the one that happens to fail', () => {
    const window = key({ itemCullMask: 2, zMin: 0, zMax: 0, layerMin: 1, layerMax: 1 });
    expect(lightReachesItem(window, 2, 0, 1)).toBe(true);
    expect(lightReachesItem(window, 1, 0, 1)).toBe(false);
    expect(lightReachesItem(window, 2, 1, 1)).toBe(false);
    expect(lightReachesItem(window, 2, 0, 0)).toBe(false);
  });

  it('reaches nothing at all through an inverted window', () => {
    // Godot does not swap the bounds, so `min > max` is an empty interval. The linter warns, and
    // the renderer obeys.
    expect(lightReachesItem(key({ zMin: 5, zMax: 4 }), 1, 4, 0)).toBe(false);
    expect(lightReachesItem(key({ zMin: 5, zMax: 4 }), 1, 5, 0)).toBe(false);
    expect(lightReachesItem(key({ layerMin: 1, layerMax: 0 }), 1, 0, 0)).toBe(false);
  });
});

describe('directionalLightCullKey', () => {
  const directional = directionalLightCullKey(0, 0);

  it('reaches an item whatever its light_mask, 0 included', () => {
    expect(lightReachesItem(directional, 2, 0, 0)).toBe(true);
    expect(lightReachesItem(directional, 0, 0, 0)).toBe(true);
  });

  it('reaches an item at any z, both ends of the z_final clamp included', () => {
    expect(lightReachesItem(directional, 1, 2000, 0)).toBe(true);
    expect(lightReachesItem(directional, 1, CANVAS_ITEM_Z_MIN, 0)).toBe(true);
    expect(lightReachesItem(directional, 1, CANVAS_ITEM_Z_MAX, 0)).toBe(true);
  });

  it('still tests the canvas layer window', () => {
    expect(lightReachesItem(directional, 1, 0, 1)).toBe(false);
    expect(lightReachesItem(directionalLightCullKey(0, 1), 1, 0, 1)).toBe(true);
  });
});
