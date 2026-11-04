/**
 * The **CanvasItem state** of one canvas item: its tint, `z_final`, draw-order key, material,
 * sampler and light mask, and the scope its descendants inherit. Godot draws a Control and a
 * Node2D by the one `_cull_canvas_item` walk (`servers/rendering/renderer_canvas_cull.cpp:303-489`),
 * so `CanvasItem2D` and `ControlCanvasWalker` both take this state from here.
 */

import { useMemo, type ReactNode } from 'react';
import type { Rgba } from '../godot/math/math';
import type { CanvasItemMaterialProperties } from '../resources/materials/canvasitemmaterial/types';
import {
  Modulate2DContext,
  WHITE_MODULATE,
  multiplyModulate,
  useCanvasItemTint,
  type CanvasItemTint,
} from './canvasItemModulate';
import { useCanvasModulateFor } from './canvasModulate';
import { TextureSampler2DContext, type CanvasItemTextureSampler } from './canvasItemTextureSampler';
import { canvasRenderOrder } from './canvasPaintOrder';
import { useLayerRank } from './contexts/PaintOrderContext';
import { CanvasItemMaterialProvider } from './components/canvasItemMaterialContext';
import {
  EffectiveZProvider,
  accumulateCanvasItemZ,
  useCanvasLayerIndex,
  useEffectiveZ,
} from './lighting2d/canvasItemPlacement';

/** One canvas item's contribution to `p_z` (`renderer_canvas_cull.cpp:430-434`). */
export interface CanvasItemZStep {
  zIndex: number;
  zAsRelative: boolean;
}

/**
 * Canvas items the walk descends through that draw no group of their own here, outermost first,
 * such as the Node2D chain a promoted Control was walked past. They sit between the ambient and
 * the item, so their modulate and z fold in that order.
 */
export interface SkippedCanvasItems {
  /** The product of their `modulate`. Their `self_modulate` never propagates. */
  modulate: Rgba;
  /** A list, not a sum: `p_z` clamps at every step, and an absolute step restarts it. */
  z: readonly CanvasItemZStep[];
}

/** The parsed CanvasItem fields of one item, with its material and sampler already resolved. */
export interface CanvasItemFields {
  modulate: Rgba;
  selfModulate: Rgba;
  zIndex: number;
  zAsRelative: boolean;
  /** The `CanvasItemMaterial` in force after `use_parent_material`, or null for plain canvas blending. */
  material: CanvasItemMaterialProperties | null;
  /** The effective filter and repeat, which the descendants inherit. */
  sampler: CanvasItemTextureSampler;
  /** `light_mask`, Godot's default 1 (`canvas_item.h:98`) when unset. */
  lightMask: number | undefined;
  /** The item's draw sequence, its place in the canvas's pre-order walk. */
  sequence: number;
  skipped?: SkippedCanvasItems;
}

export interface CanvasItemState {
  /** The draw-order key the item's group carries as its `renderOrder`. */
  key: number;
  /** The key of another draw sequence at this item's layer and `z_final`, such as its subtree's last. */
  keyAt: (sequence: number) => number;
  /** Godot's `z_final`: what a light's z window tests, and the bucket of `key`. */
  zFinal: number;
  tint: CanvasItemTint;
  material: CanvasItemMaterialProperties | null;
  sampler: CanvasItemTextureSampler;
  lightMask: number | undefined;
}

const NO_SKIPPED_ITEMS: SkippedCanvasItems = { modulate: WHITE_MODULATE, z: [] };

export function useCanvasItemState(fields: CanvasItemFields): CanvasItemState {
  const skipped = fields.skipped ?? NO_SKIPPED_ITEMS;
  const zFinal = useZFinal(fields, skipped.z);
  // The canvas tint reaches the item's own pixels when its light mode admits it, never what its
  // children inherit. The light injection divides this value back out, so both read this one hook.
  const canvasModulate = useCanvasModulateFor(fields.material);
  const tint = useCanvasItemTint(useFoldedModulates(fields, skipped.modulate), canvasModulate);
  const layerRank = useLayerRank(useCanvasLayerIndex());
  const keyAt = useMemo(
    () => (sequence: number) => canvasRenderOrder({ layerRank, zFinal, sequence }),
    [layerRank, zFinal]
  );
  return {
    key: keyAt(fields.sequence),
    keyAt,
    zFinal,
    tint,
    material: fields.material,
    sampler: fields.sampler,
    lightMask: fields.lightMask,
  };
}

/** `p_z` accumulated through the skipped items, one step each, and then the item's own. */
function useZFinal(fields: CanvasItemFields, skippedZ: readonly CanvasItemZStep[]): number {
  const parentZ = useEffectiveZ();
  const steps = [...skippedZ, { zIndex: fields.zIndex, zAsRelative: fields.zAsRelative }];
  return steps.reduce(
    (z, step) => accumulateCanvasItemZ(z, { z_index: step.zIndex, z_as_relative: step.zAsRelative }),
    parentZ
  );
}

/** The item's `modulate` with the skipped items' product folded in front of it, as the walk meets them. */
function useFoldedModulates(
  fields: CanvasItemFields,
  skippedModulate: Rgba
): { modulate: Rgba; self_modulate: Rgba } {
  const { modulate, selfModulate } = fields;
  return useMemo(
    () => ({
      modulate: multiplyModulate(skippedModulate, modulate),
      self_modulate: selfModulate,
    }),
    [skippedModulate, modulate, selfModulate]
  );
}

/** What an item's descendants inherit: its modulate, `z_final`, material and sampler. */
export function CanvasItemChildScope({ state, children }: { state: CanvasItemState; children: ReactNode }) {
  return (
    <Modulate2DContext.Provider value={state.tint.inherited}>
      <EffectiveZProvider value={state.zFinal}>
        {/* Descendants inherit through `use_parent_material` what this item resolved, a null
            included, which stops an inherited material. */}
        <CanvasItemMaterialProvider value={state.material}>
          <TextureSampler2DContext.Provider value={state.sampler}>
            {children}
          </TextureSampler2DContext.Provider>
        </CanvasItemMaterialProvider>
      </EffectiveZProvider>
    </Modulate2DContext.Provider>
  );
}

/**
 * A run of draw-order keys from `key` up to, not including, `key + span`. A whole key's slot spans
 * 1, since the next draw sequence takes the next integer key.
 */
export interface CanvasSlot {
  key: number;
  span: number;
}

/**
 * The slots of the pieces an item draws after the pixels at `slot` and before the next slot, in
 * the order listed. Godot draws such a piece as an internal child item, which the tree here does
 * not list. Each piece's slot nests inside its parent's, so a piece can hand out pieces of its own.
 */
export function canvasSubOrders<const Piece extends string>(
  slot: number | CanvasSlot,
  pieces: readonly Piece[]
): Readonly<Record<Piece, CanvasSlot>> {
  return Object.fromEntries(
    pieces.map((piece, index) => [piece, canvasPieceSlot(slot, index, pieces.length)])
  ) as Record<Piece, CanvasSlot>;
}

/** The slot of piece `index` of `count` that `canvasSubOrders` hands out, for a run of pieces with no names. */
export function canvasPieceSlot(slot: number | CanvasSlot, index: number, count: number): CanvasSlot {
  const { key, span } = typeof slot === 'number' ? { key: slot, span: 1 } : slot;
  const step = span / (count + 1);
  return { key: key + (index + 1) * step, span: step };
}
