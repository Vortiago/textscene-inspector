/**
 * Threads the draw-sequence run a canvas item's subtree owns and its canvas's
 * rank. Each item accumulates `z_final` itself. A range, not a number, lets a
 * y-sort pass re-pack its run with no view of the rest (`canvasPaintOrder.ts`).
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import {
  allocateNodePaintRange,
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

export function LayerRanksProvider({ value, children }: { value: readonly number[]; children: ReactNode }) {
  return <LayerRankContext.Provider value={value}>{children}</LayerRankContext.Provider>;
}

/** This node's draw sequence: the first value of the run its subtree owns. */
export function useNodePaintSequence(node: TscnNode): number {
  const range = usePaintRange();
  return useMemo(() => allocateNodePaintRange(range, node).self, [range, node]);
}

/**
 * The `renderOrder` of a canvas item's group, Godot's whole draw-order key, for a slice that draws
 * outside `<CanvasItem2D>` (`canvasItemState.tsx` gives it to every item that does). The caller
 * passes `effectiveZ`, already accumulated for the light cull.
 */
export function useCanvasItemRenderOrder(node: TscnNode, effectiveZ: number): number {
  const layerRank = useLayerRank(useCanvasLayerIndex());
  const sequence = useNodePaintSequence(node);
  return canvasRenderOrder({ layerRank, zFinal: effectiveZ, sequence });
}
