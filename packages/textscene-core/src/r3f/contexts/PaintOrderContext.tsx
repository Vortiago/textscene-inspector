/**
 * PaintOrderContext — threads the two things a canvas item needs to place
 * itself in Godot's draw order but cannot know on its own: the run of
 * draw-sequence values its subtree owns, and the rank of the canvas it draws on.
 *
 * The third part of the key, `z_final`, each item accumulates for itself
 * (`accumulateCanvasItemZ`), so it is deliberately NOT threaded here.
 *
 * A range is handed down rather than a bare sequence number because a y-sort
 * pass re-orders the items it collected: given the run its subtree owns, it can
 * re-pack that run in sorted order without knowing anything about the rest of
 * the canvas. See `canvasPaintOrder.ts`.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import {
  allocatePaintRange,
  canvasRenderOrder,
  layerRankOf,
  layerRanks,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../canvasPaintOrder';
import { useCanvasLayerIndex } from '../lighting2d/canvasItemPlacement';

const PaintRangeContext = createContext<PaintRange>(WHOLE_CANVAS_RANGE);
PaintRangeContext.displayName = 'PaintRangeContext';

/**
 * The draw-sequence run this node and its subtree own. Defaults to the whole
 * canvas, which is what a bare test mount (and any node rendered outside a 2D
 * stage) gets — one item owning everything orders correctly against nothing.
 */
export function usePaintRange(): PaintRange {
  return useContext(PaintRangeContext);
}

export function PaintRangeProvider({ value, children }: { value: PaintRange; children: ReactNode }) {
  return <PaintRangeContext.Provider value={value}>{children}</PaintRangeContext.Provider>;
}

const LayerRankContext = createContext<readonly number[]>(layerRanks([]));
LayerRankContext.displayName = 'LayerRankContext';

/** The rank of `layer` among the canvas layers this scene declares. */
export function useLayerRank(layer: number): number {
  return layerRankOf(useContext(LayerRankContext), layer);
}

export function LayerRanksProvider({
  value,
  children,
}: {
  value: readonly number[];
  children: ReactNode;
}) {
  return <LayerRankContext.Provider value={value}>{children}</LayerRankContext.Provider>;
}

/**
 * The `renderOrder` this canvas item's group takes — Godot's whole draw-order
 * key for it (`canvasPaintOrder.ts`).
 *
 * `<CanvasItem2D>` is the usual caller, but a slice that draws outside that
 * ritual needs the identical value, and a second derivation of it would be a
 * second answer to "where does this draw". `effectiveZ` is passed in rather
 * than accumulated here because a caller that has it has already needed it for
 * the light cull, and accumulating twice is what `accumulateCanvasItemZ`'s own
 * doc warns against.
 */
export function useCanvasItemRenderOrder(node: TscnNode, effectiveZ: number): number {
  const range = usePaintRange();
  const layerRank = useLayerRank(useCanvasLayerIndex());
  const sortsChildren = (node.properties as { y_sort_enabled?: boolean }).y_sort_enabled === true;
  const sequence = useMemo(
    () => allocatePaintRange(range, node.children, sortsChildren).self,
    [range, node.children, sortsChildren]
  );
  return canvasRenderOrder({ layerRank, zFinal: effectiveZ, sequence });
}
