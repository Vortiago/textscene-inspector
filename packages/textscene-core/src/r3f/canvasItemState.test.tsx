/**
 * The CanvasItem state of one canvas item, through `useCanvasItemState`: the tint, `z_final` and
 * draw-order key that `CanvasItem2D` and `ControlCanvasWalker` both take from it.
 * `canvasItemModulate.test.ts` covers the modulate product's arithmetic.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  canvasPieceSlot,
  canvasSubOrder,
  canvasSubOrders,
  ownAndBackSlots,
  wholeKeySlot,
  useCanvasItemState,
  useCanvasRunKeysOfNode,
  type CanvasItemFields,
} from './canvasItemState';
import { CanvasModulateContext } from './canvasModulate';
import { inheritedState } from './testing/inheritedFrom';
import { WHOLE_CANVAS_RANGE, canvasRenderOrder, layerRankOf, layerRanks } from './canvasPaintOrder';
import { PaintRangeProvider } from './contexts/PaintOrderContext';
import { CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN } from '../godot/rendering/rendering';
import { CanvasItemMaterialLightMode } from '../godot/scene/canvasItemMaterial';
import { canvasItemMaterial } from './testing/canvasItemMaterial';
import type { Rgba } from '../godot/math/math';

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
const HALF: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 0.5 };
const WORLD_RANK = layerRankOf(layerRanks([]), 0);

function fields(overrides: Partial<CanvasItemFields> = {}): Omit<CanvasItemFields, 'inherited'> {
  return {
    modulate: WHITE,
    selfModulate: WHITE,
    zIndex: 0,
    zAsRelative: true,
    material: null,
    sampler: { filter: 1, repeat: 1 },
    lightMask: 1,
    sequence: 1,
    ...overrides,
  };
}

interface Ambient {
  modulate?: Rgba;
  canvasModulate?: Rgba;
  z?: number;
}

/** `item` below a parent that hands it `modulate` and `z`, in a canvas tinted `canvasModulate`. */
function stateOf(
  item: Omit<CanvasItemFields, 'inherited'>,
  { modulate = WHITE, canvasModulate = WHITE, z = 0 }: Ambient = {}
) {
  const inherited = inheritedState({ modulate, zFinal: z });
  return renderHook(() => useCanvasItemState({ ...item, inherited }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <CanvasModulateContext.Provider value={canvasModulate}>{children}</CanvasModulateContext.Provider>
    ),
  }).result.current;
}

describe('the tint', () => {
  it('is opaque white when nothing tints the item', () => {
    const { tint } = stateOf(fields());
    expect(tint.own).toEqual(WHITE);
    expect(tint.inherited).toEqual(WHITE);
  });

  it("passes the inherited modulate times the item's own to the descendants, never its self_modulate", () => {
    const { tint } = stateOf(fields({ modulate: HALF, selfModulate: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }), {
      modulate: HALF,
    });
    expect(tint.inherited.r).toBeCloseTo(0.25, 6);
    expect(tint.inherited.a).toBeCloseTo(0.25, 6);
  });

  it("draws the item's own pixels at that times self_modulate, folding the own modulate once", () => {
    const { tint } = stateOf(fields({ modulate: HALF, selfModulate: HALF }), { modulate: HALF });
    expect(tint.own.r).toBeCloseTo(0.125, 6);
    expect(tint.opacity).toBeCloseTo(0.125, 6);
  });

  it('multiplies the canvas tint into the own pixels only', () => {
    const { tint } = stateOf(fields(), { canvasModulate: { r: 0.5, g: 0.2, b: 1, a: 1 } });
    expect(tint.own.r).toBeCloseTo(0.5, 6);
    expect(tint.own.g).toBeCloseTo(0.2, 6);
    expect(tint.inherited).toEqual(WHITE);
  });

  it('keeps the canvas tint off an Unshaded item, as the light-mode guard in canvas.glsl does', () => {
    const { tint } = stateOf(fields({ material: canvasItemMaterial(CanvasItemMaterialLightMode.UNSHADED) }), {
      canvasModulate: { r: 0.5, g: 0.2, b: 1, a: 1 },
    });
    expect(tint.own).toEqual(WHITE);
  });

  it('converts the sRGB product to linear exactly once', () => {
    const { tint } = stateOf(fields({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }));
    const expected = new THREE.Color().setRGB(0.5, 0.5, 0.5, THREE.SRGBColorSpace);
    expect(tint.color.r).toBeCloseTo(expected.r, 6);
  });
});

describe('z_final', () => {
  it("adds a relative z_index onto the parent's", () => {
    expect(stateOf(fields({ zIndex: 3 }), { z: 5 }).zFinal).toBe(8);
  });

  it('restarts from an absolute z_index', () => {
    expect(stateOf(fields({ zIndex: 3, zAsRelative: false }), { z: 5 }).zFinal).toBe(3);
  });

  it("clamps a relative sum to Godot's canvas-item z range", () => {
    expect(stateOf(fields({ zIndex: 9000 })).zFinal).toBe(CANVAS_ITEM_Z_MAX);
    expect(stateOf(fields({ zIndex: -9000 })).zFinal).toBe(CANVAS_ITEM_Z_MIN);
  });
});

describe('the draw-order key', () => {
  it('packs the canvas layer, z_final and draw sequence as every canvas item does', () => {
    const { key } = stateOf(fields({ zIndex: 2, sequence: 7 }));
    expect(key).toBe(canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 2, sequence: 7 }));
  });

  it('gives the key of another draw sequence at the same layer and z_final', () => {
    const state = stateOf(fields({ zIndex: 2, sequence: 7 }));
    expect(state.keyAt(12)).toBe(canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 2, sequence: 12 }));
  });
});

describe('canvasSubOrders', () => {
  const KEY_40 = wholeKeySlot(40);

  it('orders the pieces as listed, strictly above the key and below the next one', () => {
    const { panel, label, icon } = canvasSubOrders(KEY_40, ['panel', 'label', 'icon']);
    expect(40 < panel.key && panel.key < label.key && label.key < icon.key && icon.key < 41).toBe(true);
  });

  it("keeps a piece's own pieces below the next piece", () => {
    const { bars, minimap } = canvasSubOrders(KEY_40, ['bars', 'minimap']);
    const grabber = canvasSubOrder(bars);
    expect(bars.key < grabber.key && grabber.key < minimap.key).toBe(true);
  });

  it('hands an unnamed run of pieces the slots a named list of that length gets', () => {
    const { b } = canvasSubOrders(KEY_40, ['a', 'b', 'c']);
    expect(canvasPieceSlot(KEY_40, 1, 3)).toEqual(b);
  });

  it('hands one piece the slot a one-name list gets', () => {
    expect(canvasSubOrder(KEY_40)).toEqual(canvasSubOrders(KEY_40, ['only']).only);
  });

  it('gives each key its own pieces, so two keys never interleave', () => {
    const below = canvasSubOrders(KEY_40, ['a', 'b']);
    const above = canvasSubOrders(wholeKeySlot(41), ['a', 'b']);
    expect(below.b.key < above.a.key).toBe(true);
  });
});

describe('ownAndBackSlots', () => {
  it('gives the back slot its own key when the range holds one', () => {
    expect(ownAndBackSlots(40, 45)).toEqual({ slot: wholeKeySlot(40), chromeSlot: wholeKeySlot(45) });
  });

  it('draws the back slot after every own piece when a squeezed range gives both one key', () => {
    const { slot, chromeSlot } = ownAndBackSlots(40, 40);
    const lastOwnPiece = canvasPieceSlot(slot, 2, 3);
    expect(40 < slot.key && lastOwnPiece.key < chromeSlot.key && chromeSlot.key < 41).toBe(true);
  });
});

describe('useCanvasRunKeysOfNode', () => {
  it('ends a run over the whole canvas past its last key, which the key encoding saturates at', () => {
    const node = { name: 'Group', type: 'CanvasGroup', properties: {}, rawProperties: {}, children: [] };
    const { result } = renderHook(() => useCanvasRunKeysOfNode(node, { zIndex: 0, zAsRelative: true }), {
      wrapper: ({ children }) => (
        <PaintRangeProvider value={WHOLE_CANVAS_RANGE}>{children}</PaintRangeProvider>
      ),
    });
    const lastKey = canvasRenderOrder({
      layerRank: layerRankOf(layerRanks([]), 0),
      zFinal: 0,
      sequence: WHOLE_CANVAS_RANGE.size - 1,
    });

    expect(result.current.to).toBe(lastKey + 1);
  });
});
