/**
 * Godot builds each item's light list in `renderer_canvas_render_rd.cpp:2366-2385`: every light
 * whose mask, z window and rect reach the item, with a shadow flag where the item's `light_mask`
 * meets the light's `item_shadow_mask`. Directional lights reach every item on their layers
 * (`canvas.glsl:727-760`). These tests pin the list the previewer accumulates one buffer for.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_LIGHT_CULL_KEY, directionalLightCullKey, type LightCullKey } from './lightCullKey';
import { MAX_LIGHTS_PER_ITEM } from '../../godot/rendering';
import {
  itemLightList,
  itemPositionalLights,
  positionalCandidates,
  drawsInPass,
  planLightLists,
  placementId,
  type CanvasLightDeclaration,
  type ItemPlacement,
  type PlacementDeclarations,
} from './itemLightList';
import type { Rect2 } from '../../godot/rect2';

function key(overrides: Partial<LightCullKey> = {}): LightCullKey {
  return { ...DEFAULT_LIGHT_CULL_KEY, ...overrides };
}

function light(overrides: Partial<CanvasLightDeclaration> = {}): CanvasLightDeclaration {
  return { reach: key(), sequence: 0, shadowItemCullMask: null, tintsShadow: false, ...overrides };
}

const ITEM: ItemPlacement = { lightMask: 1, z: 0, layer: 0, positionalLights: null };

function lights(...declarations: CanvasLightDeclaration[]): ReadonlyMap<number, CanvasLightDeclaration> {
  return new Map(declarations.map((declaration, ordinal) => [ordinal, declaration]));
}

describe('itemLightList', () => {
  it('lists every light that reaches the item, by ordinal', () => {
    const list = itemLightList(lights(light(), light()), ITEM);
    expect(list.map((entry) => entry.ordinal)).toEqual([0, 1]);
  });

  it('lists lights of different cull masks together, so one buffer applies them in order', () => {
    const list = itemLightList(lights(light(), light({ reach: key({ itemCullMask: 2 }) })), {
      ...ITEM,
      lightMask: 3,
    });
    expect(list.map((entry) => entry.ordinal)).toEqual([0, 1]);
  });

  it('leaves out a light the cull test rejects', () => {
    const list = itemLightList(lights(light({ reach: key({ zMax: -1 }) }), light()), ITEM);
    expect(list.map((entry) => entry.ordinal)).toEqual([1]);
  });

  it('is empty for an item no light reaches', () => {
    expect(itemLightList(lights(light()), { ...ITEM, lightMask: 512 })).toEqual([]);
  });

  it('lists a directional light for an item of any light_mask', () => {
    const sun = light({ reach: directionalLightCullKey(0, 0) });
    expect(itemLightList(lights(sun), { ...ITEM, lightMask: 0 })).toHaveLength(1);
  });

  it('shadows an item whose light_mask meets the shadow_item_cull_mask', () => {
    const [entry] = itemLightList(lights(light({ reach: key({ itemCullMask: 3 }), shadowItemCullMask: 2 })), {
      ...ITEM,
      lightMask: 2,
    });
    expect(entry!.unshadowed).toBe(false);
  });

  it('leaves an item unshadowed whose light_mask misses the shadow_item_cull_mask', () => {
    const [entry] = itemLightList(
      lights(light({ reach: key({ itemCullMask: 3 }), shadowItemCullMask: 2 })),
      ITEM
    );
    expect(entry!.unshadowed).toBe(true);
  });

  it('draws a light that casts nothing as authored', () => {
    const [entry] = itemLightList(lights(light()), ITEM);
    expect(entry!.unshadowed).toBe(false);
  });
});

describe('itemLightList under the per-item cap', () => {
  it('leaves out a positional light the item does not take', () => {
    const list = itemLightList(lights(light(), light()), { ...ITEM, positionalLights: [1] });
    expect(list.map((entry) => entry.ordinal)).toEqual([1]);
  });

  it('keeps a directional light, which the cap does not count', () => {
    const sun = light({ reach: directionalLightCullKey(0, 0), sequence: null });
    const list = itemLightList(lights(sun, light()), { ...ITEM, positionalLights: [] });
    expect(list.map((entry) => entry.ordinal)).toEqual([0]);
  });
});

/**
 * Godot's per-item limit on positional lights: the loop breaks at `MAX_LIGHTS_PER_ITEM - 1`
 * (`renderer_canvas_render_rd.cpp:2380`).
 */
const CAP = MAX_LIGHTS_PER_ITEM - 1;

const ITEM_RECT: Rect2 = { x: 0, y: 0, w: 10, h: 10 };
const OVER_ITEM: Rect2 = { x: -5, y: -5, w: 10, h: 10 };
const PAST_ITEM: Rect2 = { x: 20, y: 20, w: 10, h: 10 };

/** `count` positional lights in tree order, ordinal `n` at sequence `n`. */
function positionalLights(count: number): ReadonlyMap<number, CanvasLightDeclaration> {
  return lights(...Array.from({ length: count }, (_, sequence) => light({ sequence })));
}

function rectsOver(ordinals: Iterable<number>, rect = OVER_ITEM): Map<number, Rect2> {
  return new Map([...ordinals].map((ordinal) => [ordinal, rect]));
}

describe('positionalCandidates', () => {
  it('lists every positional light that reaches the placement, past the cap too', () => {
    expect(positionalCandidates(positionalLights(CAP + 1), ITEM)).toHaveLength(CAP + 1);
  });

  it('orders by sequence, not by ordinal', () => {
    expect(positionalCandidates(lights(light({ sequence: 1 }), light({ sequence: 0 })), ITEM)).toEqual([
      1, 0,
    ]);
  });

  it('breaks a sequence tie by ordinal', () => {
    expect(positionalCandidates(lights(light(), light()), ITEM)).toEqual([0, 1]);
  });

  it('leaves out a light the cull test rejects', () => {
    const all = lights(light({ reach: key({ itemCullMask: 2 }) }), light({ sequence: 1 }));
    expect(positionalCandidates(all, ITEM)).toEqual([1]);
  });

  it('leaves out a directional light, which the cap does not count', () => {
    const sun = light({ reach: directionalLightCullKey(0, 0), sequence: null });
    expect(positionalCandidates(lights(sun), ITEM)).toEqual([]);
  });
});

describe('itemPositionalLights', () => {
  const ordinals = (count: number) => [...Array(count).keys()];

  it('drops the candidates that meet the item past the 15th', () => {
    const candidates = ordinals(CAP + 3);
    expect(itemPositionalLights(candidates, ITEM_RECT, rectsOver(candidates))).toEqual(ordinals(CAP));
  });

  it('keeps the candidates in their order', () => {
    const candidates = [...ordinals(CAP + 1)].reverse();
    expect(itemPositionalLights(candidates, ITEM_RECT, rectsOver(candidates))).toEqual(
      candidates.slice(0, CAP)
    );
  });

  it('gives the slot of a light whose rect misses the item to the next light, and keeps the miss', () => {
    // The missing light adds nothing at the item's pixels, so the list may hold it.
    const candidates = ordinals(CAP + 2);
    const rects = rectsOver(candidates);
    rects.set(0, PAST_ITEM);
    expect(itemPositionalLights(candidates, ITEM_RECT, rects)).toEqual(ordinals(CAP + 1));
  });

  it('is null while the lights that meet the item fit, so it shares the placement list', () => {
    const candidates = ordinals(CAP + 5);
    const rects = rectsOver(candidates.slice(0, CAP), OVER_ITEM);
    for (const ordinal of candidates.slice(CAP)) rects.set(ordinal, PAST_ITEM);
    expect(itemPositionalLights(candidates, ITEM_RECT, rects)).toBeNull();
  });

  it('counts a rect that only touches the item as a miss', () => {
    const candidates = ordinals(CAP + 1);
    const rects = rectsOver(candidates);
    rects.set(0, { x: 10, y: 0, w: 10, h: 10 });
    expect(itemPositionalLights(candidates, ITEM_RECT, rects)).toBeNull();
  });

  it('counts a light with no rect as a miss, as it draws nothing', () => {
    const candidates = ordinals(CAP + 1);
    const rects = rectsOver(candidates);
    rects.delete(0);
    expect(itemPositionalLights(candidates, ITEM_RECT, rects)).toBeNull();
  });
});

function placements(...items: [ItemPlacement, boolean][]): ReadonlyMap<string, PlacementDeclarations> {
  return new Map(
    items.map(([placement, hasLightOnly]) => [placementId(placement), { placement, hasLightOnly }])
  );
}

describe('placementId', () => {
  it('separates two placements that take different positional lights', () => {
    expect(placementId({ ...ITEM, positionalLights: [0, 1] })).not.toBe(
      placementId({ ...ITEM, positionalLights: [0] })
    );
  });

  it('separates a capped placement from an uncapped one', () => {
    expect(placementId({ ...ITEM, positionalLights: [] })).not.toBe(placementId(ITEM));
  });
});

describe('planLightLists', () => {
  it('gives placements with the same list one plan', () => {
    const plans = planLightLists(lights(light()), placements([ITEM, false], [{ ...ITEM, z: 3 }, false]));
    expect(plans).toHaveLength(1);
    expect(plans[0]!.placementIds).toEqual([placementId(ITEM), placementId({ ...ITEM, z: 3 })]);
  });

  it('gives placements with different lists a plan each', () => {
    const plans = planLightLists(
      lights(light(), light({ reach: key({ itemCullMask: 2 }) })),
      placements([ITEM, false], [{ ...ITEM, lightMask: 3 }, false])
    );
    expect(plans.map((plan) => plan.entries.map((entry) => entry.ordinal))).toEqual([[0], [0, 1]]);
  });

  it('gives placements a plan each when their lists differ only in one shadow state', () => {
    const all = lights(light({ reach: key({ itemCullMask: 3 }), shadowItemCullMask: 2 }));
    const plans = planLightLists(all, placements([ITEM, false], [{ ...ITEM, lightMask: 2 }, false]));
    expect(plans.map((plan) => plan.entries[0]!.unshadowed)).toEqual([true, false]);
  });

  it('leaves out a placement no light reaches', () => {
    expect(planLightLists(lights(light()), placements([{ ...ITEM, lightMask: 2 }, false]))).toEqual([]);
  });

  it('asks for the unmodulated buffer once any placement on the list holds a Light Only item', () => {
    const plans = planLightLists(lights(light()), placements([ITEM, false], [{ ...ITEM, z: 3 }, true]));
    expect(plans[0]!.hasLightOnly).toBe(true);
  });

  it('asks for no unmodulated buffer while no placement holds a Light Only item', () => {
    expect(planLightLists(lights(light()), placements([ITEM, false]))[0]!.hasLightOnly).toBe(false);
  });

  it('tints a list that holds a shadowed light which tints', () => {
    const plans = planLightLists(lights(light({ tintsShadow: true })), placements([ITEM, false]));
    expect(plans[0]!.tintsShadow).toBe(true);
  });

  it('does not tint a list on which the tinting light is unshadowed', () => {
    const tinting = light({ reach: key({ itemCullMask: 3 }), shadowItemCullMask: 2, tintsShadow: true });
    expect(planLightLists(lights(tinting), placements([ITEM, false]))[0]!.tintsShadow).toBe(false);
  });
});

describe('drawsInPass', () => {
  const shadowed = { ordinal: 0, unshadowed: false };
  const escaping = { ordinal: 0, unshadowed: true };

  it('draws a light absent from the list in no pass', () => {
    for (const role of ['volume', 'lit', 'shade', 'tint', 'fade', 'unshadowed', 'unshadowedFade'] as const) {
      expect(drawsInPass(undefined, role, 'light')).toBe(false);
      expect(drawsInPass(undefined, role, 'tint')).toBe(false);
    }
  });

  it('draws the volumes and the lit quad in the light pass for a shadowed item', () => {
    expect(drawsInPass(shadowed, 'volume', 'light')).toBe(true);
    expect(drawsInPass(shadowed, 'lit', 'light')).toBe(true);
    expect(drawsInPass(shadowed, 'unshadowed', 'light')).toBe(false);
    expect(drawsInPass(shadowed, 'tint', 'light')).toBe(false);
  });

  it('draws only the unshadowed quad in the light pass for an escaping item', () => {
    expect(drawsInPass(escaping, 'unshadowed', 'light')).toBe(true);
    expect(drawsInPass(escaping, 'volume', 'light')).toBe(false);
    expect(drawsInPass(escaping, 'lit', 'light')).toBe(false);
  });

  it('draws the volumes and the tint quad in the tint pass, for a shadowed item only', () => {
    expect(drawsInPass(shadowed, 'volume', 'tint')).toBe(true);
    expect(drawsInPass(shadowed, 'tint', 'tint')).toBe(true);
    expect(drawsInPass(shadowed, 'lit', 'tint')).toBe(false);
    expect(drawsInPass(escaping, 'tint', 'tint')).toBe(false);
    expect(drawsInPass(escaping, 'volume', 'tint')).toBe(false);
  });

  it("draws the shade quad, the shadow_color's alpha, in the light pass of a shadowed item", () => {
    expect(drawsInPass(shadowed, 'shade', 'light')).toBe(true);
    expect(drawsInPass(shadowed, 'shade', 'tint')).toBe(false);
    expect(drawsInPass(escaping, 'shade', 'light')).toBe(false);
  });

  it('draws the fade quad, the lit alpha, in the tint pass of a shadowed item', () => {
    expect(drawsInPass(shadowed, 'fade', 'tint')).toBe(true);
    expect(drawsInPass(shadowed, 'fade', 'light')).toBe(false);
    expect(drawsInPass(escaping, 'fade', 'tint')).toBe(false);
  });

  it('draws the unshadowed fade quad in the tint pass of an escaping item', () => {
    expect(drawsInPass(escaping, 'unshadowedFade', 'tint')).toBe(true);
    expect(drawsInPass(escaping, 'unshadowedFade', 'light')).toBe(false);
    expect(drawsInPass(shadowed, 'unshadowedFade', 'tint')).toBe(false);
  });
});
