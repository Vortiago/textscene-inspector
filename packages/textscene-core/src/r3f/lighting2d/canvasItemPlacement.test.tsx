/**
 * The item's `z_final` (`_cull_canvas_item`, `servers/rendering/renderer_canvas_cull.cpp` lines
 * 816-820) and its canvas's layer: 0 on the world canvas, the CanvasLayer's `layer` (default 1)
 * inside one. `servers/rendering/rendering_server_enums.h` fixes the clamp, and Godot 4.6.3
 * reports `CANVAS_ITEM_Z_MIN/MAX` as -4096 / 4096.
 */

import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {
  CANVAS_ITEM_Z_MAX,
  CANVAS_ITEM_Z_MIN,
  CanvasLayerIndexProvider,
  EffectiveZProvider,
  accumulateCanvasItemZ,
  useCanvasLayerIndex,
  useEffectiveZ,
} from './canvasItemPlacement';

describe('accumulateCanvasItemZ', () => {
  it('adds a relative z_index onto the parent\'s', () => {
    // Godot 4.6.3, light at range_z_max = 4 over a Node2D at z_index 2: a z_index-1 child
    // (effective 3) is lit, rgb(141, 122, 138), and a z_index-3 child (effective 5) is not,
    // rgb(55, 62, 106).
    expect(accumulateCanvasItemZ(2, { z_index: 3, z_as_relative: true })).toBe(5);
    expect(accumulateCanvasItemZ(0, { z_index: 0, z_as_relative: true })).toBe(0);
    expect(accumulateCanvasItemZ(-4, { z_index: 1, z_as_relative: true })).toBe(-3);
  });

  it('treats a missing z_as_relative as Godot\'s default of true', () => {
    expect(accumulateCanvasItemZ(2, { z_index: 3 })).toBe(5);
  });

  it('resets to the absolute z_index when z_as_relative is false', () => {
    // On Godot 4.6.3 that z_index-3 child is lit at absolute 3, rgb(138, 120, 137).
    expect(accumulateCanvasItemZ(2, { z_index: 3, z_as_relative: false })).toBe(3);
    expect(accumulateCanvasItemZ(4000, { z_index: -2, z_as_relative: false })).toBe(-2);
  });

  it('clamps the accumulation to Godot\'s canvas-item z range', () => {
    expect(CANVAS_ITEM_Z_MIN).toBe(-4096);
    expect(CANVAS_ITEM_Z_MAX).toBe(4096);
    expect(accumulateCanvasItemZ(4096, { z_index: 1, z_as_relative: true })).toBe(4096);
    expect(accumulateCanvasItemZ(-4096, { z_index: -1, z_as_relative: true })).toBe(-4096);
  });

  it('does NOT clamp an absolute z_index, matching the engine\'s own asymmetry', () => {
    // Godot clamps only the accumulating branch, and the else branch assigns `ci->z_index`
    // unchanged, in both `_cull_canvas_item` (816-820) and `_collect_ysort_children` (160-166).
    expect(accumulateCanvasItemZ(0, { z_index: 9000, z_as_relative: false })).toBe(9000);
  });
});

describe('the y-sort pass and the light cull agree on z', () => {
  it('buckets y-sorted items by the very function the lights are culled against', async () => {
    // Godot computes this once and reads it twice: to bucket y-sorted children, and as the
    // `z_final` a light's window tests. One function here too, so the two cannot drift.
    const { collectYSortedItems } = await import('../ySortItems');
    const node = {
      name: 'Root',
      type: 'Node2D',
      properties: {},
      children: [
        { name: 'Rel', type: 'Node2D', properties: { z_index: 3 }, children: [] },
        {
          name: 'Abs',
          type: 'Node2D',
          properties: { z_index: 3, z_as_relative: false },
          children: [],
        },
      ],
    } as unknown as Parameters<typeof collectYSortedItems>[0];

    const items = collectYSortedItems(node, { parentWorldY: 0, parentEffectiveZ: 2 }, 0);
    expect(items.map((item) => item.effectiveZ)).toEqual([
      accumulateCanvasItemZ(2, { z_index: 3, z_as_relative: true }),
      accumulateCanvasItemZ(2, { z_index: 3, z_as_relative: false }),
    ]);
    expect(items.map((item) => item.effectiveZ)).toEqual([5, 3]);
  });
});

/** Reports the placement a descendant sees. */
function Probe({ seen }: { seen: { z: number; layer: number }[] }) {
  seen.push({ z: useEffectiveZ(), layer: useCanvasLayerIndex() });
  return null;
}

describe('the placement contexts', () => {
  it('defaults to the world canvas at z 0', async () => {
    // Every 3D scene and every bare unit-test mount reads this, and it has to be
    // the value a light with Godot's default window reaches.
    const seen: { z: number; layer: number }[] = [];
    await ReactThreeTestRenderer.create(<Probe seen={seen} />);
    expect(seen.at(-1)).toEqual({ z: 0, layer: 0 });
  });

  it('threads an accumulated z and a canvas layer to descendants', async () => {
    const seen: { z: number; layer: number }[] = [];
    await ReactThreeTestRenderer.create(
      <EffectiveZProvider value={5}>
        <CanvasLayerIndexProvider value={1}>
          <Probe seen={seen} />
        </CanvasLayerIndexProvider>
      </EffectiveZProvider>
    );
    expect(seen.at(-1)).toEqual({ z: 5, layer: 1 });
  });
});
