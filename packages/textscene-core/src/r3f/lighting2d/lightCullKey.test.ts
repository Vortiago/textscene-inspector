/**
 * Godot's whole 2D light-cull test, and the class key it implies.
 *
 * The item-side half is one condition, in
 * `drivers/gles3/rasterizer_canvas_gles3.cpp`, `_record_item_commands` (line
 * 1347 on master):
 *
 *   if (light->render_index_cache >= 0 && p_item->light_mask & light->item_mask &&
 *       p_item->z_final >= light->z_min && p_item->z_final <= light->z_max &&
 *       p_item->global_rect_cache.intersects(light->rect_cache)) {
 *
 * and the canvas-side half is `servers/rendering/renderer_viewport.cpp`,
 * `_draw_viewport`'s per-canvas loop (line 1220):
 *
 *   if (E.value->layer >= ptr->layer_min && E.value->layer <= ptr->layer_max) {
 *
 * The defaults are `scene/2d/light_2d.h:50-55` (`z_min = -1024`, `z_max = 1024`,
 * `layer_min = 0`, `layer_max = 0`, `item_mask = 1`).
 *
 * Both comparisons are inclusive on both ends, which is also MEASURED rather
 * than only read: Godot 4.6.3, `unit-pointlight2d-range-z.tscn` with
 * `range_z_max = 4` lights the z_index-4 panel (rgb(213, 173, 165)) and
 * withholds the z_index-5 one (rgb(55, 62, 106) = albedo x CanvasModulate); the
 * same scene with `range_z_min = 4` lights z_index 4 and withholds z_index 0.
 *
 * Godot ships no unit test for Light2D or for canvas-item z accumulation
 * (`tests/scene` has `test_node_2d.cpp` but it never touches `z_index`), so
 * there were no engine cases to port — these are the source lines plus probes.
 *
 * The consequence for the accumulator: the light-side operands are exactly
 * these five constants, so two lights that agree on all five are
 * indistinguishable to every item and may share one accumulation buffer. The
 * class key is therefore the whole tuple, not the mask alone.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LIGHT_CULL_KEY,
  compareLightCullKeys,
  lightCullKeyId,
  lightReachesItem,
  sameLightCullKey,
  type LightCullKey,
} from './lightCullKey';

/** A key with Godot's defaults, overridden field by field. */
function key(overrides: Partial<LightCullKey> = {}): LightCullKey {
  return { ...DEFAULT_LIGHT_CULL_KEY, ...overrides };
}

describe('DEFAULT_LIGHT_CULL_KEY', () => {
  it('is Godot\'s own default light window', () => {
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
    const window = key({ zMin: -2, zMax: 4 });
    expect(lightReachesItem(window, 1, -2, 0)).toBe(true);
    expect(lightReachesItem(window, 1, 0, 0)).toBe(true);
    expect(lightReachesItem(window, 1, 4, 0)).toBe(true);
    expect(lightReachesItem(window, 1, -3, 0)).toBe(false);
    expect(lightReachesItem(window, 1, 5, 0)).toBe(false);
  });

  it('still excludes an item past the DEFAULT window, wide as it is', () => {
    // -1024..1024 is why the property goes unnoticed on scenes whose z stays
    // small, but it is a window like any other and the bound is real. Nothing
    // stops a `.tscn` authoring `z_index = 5000`, or a nested tree accumulating
    // past it: `z_index`'s own -4096..4096 is a PROPERTY_HINT_RANGE, not a
    // setter guard.
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
    // Godot does not swap the bounds, so `min > max` is an empty interval.
    // The linter warns; the renderer simply obeys.
    expect(lightReachesItem(key({ zMin: 5, zMax: 4 }), 1, 4, 0)).toBe(false);
    expect(lightReachesItem(key({ zMin: 5, zMax: 4 }), 1, 5, 0)).toBe(false);
    expect(lightReachesItem(key({ layerMin: 1, layerMax: 0 }), 1, 0, 0)).toBe(false);
  });
});

describe('lightCullKeyId', () => {
  it('gives two lights with the same window the same id', () => {
    expect(lightCullKeyId(key({ zMax: 4 }))).toBe(lightCullKeyId(key({ zMax: 4 })));
  });

  it('separates keys that differ in any single field', () => {
    const base = lightCullKeyId(key());
    for (const differing of [
      key({ itemCullMask: 2 }),
      key({ zMin: -1023 }),
      key({ zMax: 1023 }),
      key({ layerMin: 1 }),
      key({ layerMax: 1 }),
    ]) {
      expect(lightCullKeyId(differing)).not.toBe(base);
    }
  });

  it('cannot be spoofed by shifting a digit across the field boundary', () => {
    // A concatenation with no separator would collide 1|11 with 11|1.
    expect(lightCullKeyId(key({ itemCullMask: 1, zMin: 11 }))).not.toBe(
      lightCullKeyId(key({ itemCullMask: 11, zMin: 1 }))
    );
  });
});

describe('sameLightCullKey', () => {
  it('agrees with the id on identity and on difference', () => {
    expect(sameLightCullKey(key(), key())).toBe(true);
    expect(sameLightCullKey(key(), key({ layerMax: 1 }))).toBe(false);
  });
});

describe('compareLightCullKeys', () => {
  it('orders by cull mask first, so today\'s ascending-mask classes are unmoved', () => {
    const sorted = [key({ itemCullMask: 2 }), key({ itemCullMask: 1 })].sort(compareLightCullKeys);
    expect(sorted.map((k) => k.itemCullMask)).toEqual([1, 2]);
  });

  it('breaks a tie on the window, so the order depends only on WHICH keys are present', () => {
    // A class's index picks its camera layer, so mount order must never reach it.
    const keys = [
      key({ zMax: 4 }),
      key({ layerMax: 1 }),
      key(),
      key({ zMin: -4 }),
    ];
    const first = [...keys].sort(compareLightCullKeys).map(lightCullKeyId);
    const second = [...keys].reverse().sort(compareLightCullKeys).map(lightCullKeyId);
    expect(second).toEqual(first);
    // zMin ascends before zMax is consulted, and both before the layer window,
    // so the three keys at the default zMin of -1024 come before the one that
    // raised it to -4.
    expect(first).toEqual([
      lightCullKeyId(key({ zMax: 4 })),
      lightCullKeyId(key()),
      lightCullKeyId(key({ layerMax: 1 })),
      lightCullKeyId(key({ zMin: -4 })),
    ]);
  });

  it('reports 0 for equal keys', () => {
    expect(compareLightCullKeys(key(), key())).toBe(0);
  });
});
