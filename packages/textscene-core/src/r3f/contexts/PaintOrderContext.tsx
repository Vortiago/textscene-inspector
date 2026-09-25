/**
 * Threads the draw-sequence run a canvas item's subtree owns and its canvas's
 * rank. Each item accumulates `z_final` itself. A range, not a number, lets a
 * y-sort pass re-pack its run with no view of the rest (`canvasPaintOrder.ts`).
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
 * The draw-sequence run this node and its subtree own. The default is the
 * whole canvas, which a node outside a 2D stage gets.
 */
export function usePaintRange(): PaintRange {
  return useContext(PaintRangeContext);
}

export function PaintRangeProvider({ value, children }: { value: PaintRange; children: ReactNode }) {
  return <PaintRangeContext.Provider value={value}>{children}</PaintRangeContext.Provider>;
}

const NO_CANVAS_ROOTS: ReadonlyMap<TscnNode, PaintRange> = new Map();

const CanvasRootRangesContext = createContext<ReadonlyMap<TscnNode, PaintRange>>(NO_CANVAS_ROOTS);
CanvasRootRangesContext.displayName = 'CanvasRootRangesContext';

/**
 * Where each canvas root draws (`canvasRootRanges`). A canvas item whose parent
 * is not one draws at its pre-order rank among the roots, not at its nesting
 * slot, so a parent looks its children up here first.
 */
export function useCanvasRootRanges(): ReadonlyMap<TscnNode, PaintRange> {
  return useContext(CanvasRootRangesContext);
}

export function CanvasRootRangesProvider({
  value,
  children,
}: {
  value: ReadonlyMap<TscnNode, PaintRange>;
  children: ReactNode;
}) {
  return <CanvasRootRangesContext.Provider value={value}>{children}</CanvasRootRangesContext.Provider>;
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
 * The `renderOrder` of this canvas item's group, Godot's whole draw-order key.
 * A slice outside `<CanvasItem2D>` calls it too, so the order has one source.
 * The caller passes `effectiveZ`, already accumulated for the light cull.
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
