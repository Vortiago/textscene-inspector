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
  multiplyModulate,
  useParentModulate,
  useCanvasItemTint,
  type CanvasItemTint,
} from './canvasItemModulate';
import { useCanvasModulateFor } from './canvasModulate';
import { TextureSampler2DContext, type CanvasItemTextureSampler } from './canvasItemTextureSampler';
import { canvasKeyAtZ, canvasRenderOrder } from './canvasPaintOrder';
import { useLayerRank, useNodePaintSequence, usePaintRange } from './contexts/PaintOrderContext';
import type { TscnNode } from '../parser/types';
import type { Node2DProperties } from '../nodes/base/node2d/types';
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

/** The z step of a Node2D-family item, whose parser fills both fields. */
export function node2dZStep(props: Pick<Node2DProperties, 'z_index' | 'z_as_relative'>): CanvasItemZStep {
  return { zIndex: props.z_index, zAsRelative: props.z_as_relative };
}

/**
 * Canvas items the walk descends through that draw no group of their own here, outermost first,
 * such as the Node2D chain a promoted Control was walked past. They sit between the ambient and
 * the item, so `SkippedCanvasItemsScope` folds them into the ambient the item reads.
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

/**
 * The CanvasItem state of one item, under the ambient its parent published.
 *
 * @canonical The tint, z_final and draw-order key of a canvas item
 */
export function useCanvasItemState(fields: CanvasItemFields): CanvasItemState {
  const zFinal = useZFinal(fields);
  // The canvas tint reaches the item's own pixels when its light mode admits it, never what its
  // children inherit. The light injection divides this value back out, so both read this one hook.
  const canvasModulate = useCanvasModulateFor(fields.material);
  const tint = useCanvasItemTint(useTintInputs(fields), canvasModulate);
  const keyAt = useCanvasKeyAt(zFinal);
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

/**
 * The draw-order key of a canvas item that draws outside `useCanvasItemState`, such as a Camera2D's
 * gizmo, from its node and its own z step.
 */
export function useCanvasKeyOfNode(node: TscnNode, own: CanvasItemZStep): number {
  return useCanvasKeyAt(useZFinal(own))(useNodePaintSequence(node));
}

/** The keys a canvas item's run spans, `[from, to)`, at its layer and `z_final`, and its own key. */
export interface CanvasRunKeys {
  own: number;
  from: number;
  to: number;
}

/**
 * The keys of `node`'s own run, from the node and its own z step, as `useCanvasItemState` keys
 * the node and its descendants at the node's `z_final`.
 */
export function useCanvasRunKeysOfNode(node: TscnNode, own: CanvasItemZStep): CanvasRunKeys {
  const keyAt = useCanvasKeyAt(useZFinal(own));
  const sequence = useNodePaintSequence(node);
  const { base, size } = usePaintRange();
  return useMemo(() => runKeysOf(keyAt, keyAt(sequence), { base, size }), [keyAt, sequence, base, size]);
}

/** The keys of the run `range`, around the item keyed `own`. */
export function runKeysOf(
  keyAt: (sequence: number) => number,
  own: number,
  range: { base: number; size: number }
): CanvasRunKeys {
  return { own, ...keySpanOf(keyAt, range) };
}

/** The keys `[from, to)` of the run `range`, with no owner: the span of a `show_behind_parent` child. */
export function keySpanOf(
  keyAt: (sequence: number) => number,
  { base, size }: { base: number; size: number }
): { from: number; to: number } {
  // Past the last key, not at `base + size`: the encoding saturates a sequence at the stride's end.
  return { from: keyAt(base), to: keyAt(base + size - 1) + 1 };
}

/** Where a canvas item draws: its draw-order key and its `z_final`. */
export interface CanvasPlace {
  key: number;
  zFinal: number;
}

/**
 * The place of a child canvas item that the walk reaches at `parent`'s key with a relative
 * `z_index` of its own, such as a TileMap's layer (`tile_map.cpp:279,376`) or a tile layer's
 * quadrant item (`tile_map_layer.cpp:356-357`).
 *
 * @canonical The draw-order key and z_final of a child canvas item at a z of its own
 */
export function childCanvasPlace(parent: CanvasPlace, zIndex: number): CanvasPlace {
  const zFinal = stepZ(parent.zFinal, { zIndex, zAsRelative: true });
  return { key: canvasKeyAtZ(parent.key, parent.zFinal, zFinal), zFinal };
}

/** The key of each draw sequence at this canvas layer and `zFinal`. */
function useCanvasKeyAt(zFinal: number): (sequence: number) => number {
  const layerRank = useLayerRank(useCanvasLayerIndex());
  return useMemo(
    () => (sequence: number) => canvasRenderOrder({ layerRank, zFinal, sequence }),
    [layerRank, zFinal]
  );
}

function useZFinal(own: CanvasItemZStep): number {
  return stepZ(useEffectiveZ(), own);
}

/** `p_z` after one step (`renderer_canvas_cull.cpp:430-434`). */
function stepZ(parentZ: number, step: CanvasItemZStep): number {
  return accumulateCanvasItemZ(parentZ, step);
}

/** The item's tint properties in the names `useCanvasItemTint` reads. */
function useTintInputs({ modulate, selfModulate }: CanvasItemFields): {
  modulate: Rgba;
  self_modulate: Rgba;
} {
  return useMemo(() => ({ modulate, self_modulate: selfModulate }), [modulate, selfModulate]);
}

/** The ambient below `skipped`: their modulate and z folded in, as if each drew its own group. */
export function SkippedCanvasItemsScope({
  skipped,
  children,
}: {
  skipped: SkippedCanvasItems;
  children: ReactNode;
}) {
  const parentModulate = useParentModulate();
  const modulate = useMemo(
    () => multiplyModulate(parentModulate, skipped.modulate),
    [parentModulate, skipped.modulate]
  );
  const z = skipped.z.reduce(stepZ, useEffectiveZ());
  return (
    <Modulate2DContext.Provider value={modulate}>
      <EffectiveZProvider value={z}>{children}</EffectiveZProvider>
    </Modulate2DContext.Provider>
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
 *
 * @canonical A draw-order key between a canvas item's key and the next
 */
export function canvasSubOrders<const Piece extends string>(
  slot: CanvasSlot,
  pieces: readonly Piece[]
): Readonly<Record<Piece, CanvasSlot>> {
  return Object.fromEntries(
    pieces.map((piece, index) => [piece, canvasPieceSlot(slot, index, pieces.length)])
  ) as Record<Piece, CanvasSlot>;
}

/** The slot of piece `index` of `count` that `canvasSubOrders` hands out, for a run of pieces with no names. */
export function canvasPieceSlot({ key, span }: CanvasSlot, index: number, count: number): CanvasSlot {
  const step = span / (count + 1);
  return { key: key + (index + 1) * step, span: step };
}

/** The slot of the one piece an item draws after the pixels at `slot`. */
export function canvasSubOrder(slot: CanvasSlot): CanvasSlot {
  return canvasPieceSlot(slot, 0, 1);
}

/** The slot of a whole draw-order key, such as a canvas item's own: the next key starts 1 above it. */
export function wholeKeySlot(key: number): CanvasSlot {
  return { key, span: 1 };
}

/**
 * A Control's own slot and the slot of its `INTERNAL_MODE_BACK` chrome. A squeezed range can give the
 * back room no sequence past the own one, and then both share the own key, own pieces first, since
 * Godot draws the back children after the item (`scroll_container.cpp:919,924`).
 */
export function ownAndBackSlots(
  ownKey: number,
  backKey: number
): { slot: CanvasSlot; chromeSlot: CanvasSlot } {
  const own = wholeKeySlot(ownKey);
  if (backKey !== ownKey) return { slot: own, chromeSlot: wholeKeySlot(backKey) };
  return { slot: canvasPieceSlot(own, 0, 2), chromeSlot: canvasPieceSlot(own, 1, 2) };
}
