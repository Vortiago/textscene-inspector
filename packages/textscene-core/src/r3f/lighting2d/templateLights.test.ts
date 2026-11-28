import { describe, expect, it } from 'vitest';
import { DEFAULT_LIGHT_CULL_KEY, directionalLightCullKey } from './lightCullKey';
import type { CanvasLightDeclaration, ItemPlacement } from './itemLightList';
import { isShadowedByLight, itemTemplateLights, layerLightCandidates } from './templateLights';

function positional(
  sequence: number,
  overrides: Partial<CanvasLightDeclaration> = {}
): CanvasLightDeclaration {
  return {
    reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0 },
    sequence,
    shadowItemCullMask: null,
    castsShadow: false,
    tintsShadow: false,
    mixes: false,
    ...overrides,
  };
}

function directional(slot: number, overrides: Partial<CanvasLightDeclaration> = {}): CanvasLightDeclaration {
  return {
    reach: directionalLightCullKey(0, 0),
    sequence: null,
    slot,
    shadowItemCullMask: null,
    castsShadow: false,
    tintsShadow: false,
    mixes: false,
    ...overrides,
  };
}

const ITEM: ItemPlacement = { lightMask: 1, z: 0, layer: 0, takenLights: null };

describe('layerLightCandidates', () => {
  it('lists the directional lights by slot, and the positional lights by sequence', () => {
    const lights = new Map([
      [0, positional(5)],
      [1, directional(1)],
      [2, positional(2)],
      [3, directional(0)],
    ]);
    expect(layerLightCandidates(lights, 0)).toEqual({ directional: [3, 1], positional: [2, 0] });
  });

  it('leaves out a light whose layer window misses the canvas layer', () => {
    const lights = new Map([
      [0, positional(0)],
      [1, positional(1, { reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 1, layerMax: 3 } })],
      [2, directional(0, { reach: directionalLightCullKey(2, 2) })],
    ]);
    expect(layerLightCandidates(lights, 2)).toEqual({ directional: [2], positional: [1] });
  });

  it('keeps every light of a layer: the render caps the ones it lists on screen', () => {
    const lights = new Map(Array.from({ length: 300 }, (_, ordinal) => [ordinal, positional(ordinal)]));
    expect(layerLightCandidates(lights, 0).positional).toHaveLength(300);
  });
});

describe('itemTemplateLights', () => {
  it('takes the positional lights that reach the item, by sequence', () => {
    const lights = new Map([
      [0, positional(1)],
      [1, directional(0)],
      [2, positional(0)],
    ]);
    expect(itemTemplateLights(lights, ITEM, null)).toEqual([2, 0]);
  });

  it('takes only the positional lights whose mask and z window reach the item', () => {
    const lights = new Map([
      [0, positional(0, { reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0, itemCullMask: 2 } })],
      [
        1,
        positional(1, { reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0, zMin: 1, zMax: 4 } }),
      ],
      [2, positional(2)],
    ]);
    expect(itemTemplateLights(lights, ITEM, null)).toEqual([2]);
  });

  it("takes the cap's list of the lights that meet the item when one is given", () => {
    const lights = new Map(Array.from({ length: 20 }, (_, ordinal) => [ordinal, positional(ordinal)]));
    expect(itemTemplateLights(lights, ITEM, [17, 3])).toEqual([17, 3]);
  });
});

describe('isShadowedByLight', () => {
  it('holds for a positional light that casts onto the mask of the item', () => {
    const casting = positional(0, { castsShadow: true, shadowItemCullMask: 1 });
    expect(isShadowedByLight(new Map([[0, casting]]), ITEM)).toBe(true);
  });

  it("fails for a casting light whose shadow mask misses the item's mask", () => {
    const casting = positional(0, { castsShadow: true, shadowItemCullMask: 2 });
    expect(isShadowedByLight(new Map([[0, casting]]), ITEM)).toBe(false);
  });

  it('holds for a casting directional light on the layer', () => {
    expect(isShadowedByLight(new Map([[0, directional(0, { castsShadow: true })]]), ITEM)).toBe(true);
  });

  it('fails for a casting light that does not reach the item', () => {
    const elsewhere = positional(0, {
      castsShadow: true,
      shadowItemCullMask: 1,
      reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0, itemCullMask: 4 },
    });
    expect(isShadowedByLight(new Map([[0, elsewhere]]), ITEM)).toBe(false);
  });
});
