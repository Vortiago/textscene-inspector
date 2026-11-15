/**
 * Threads the ranks of the canvas layers a viewport declares. Each item reads its draw sequence
 * from the paint pass (`canvasItemPass/nodePaint.tsx`) and accumulates `z_final` itself.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { layerRankOf, layerRanks } from '../canvasPaintOrder';

const LayerRankContext = createContext<readonly number[]>(layerRanks([]));
LayerRankContext.displayName = 'LayerRankContext';

/** The rank of `layer` among the canvas layers this scene declares. */
export function useLayerRank(layer: number): number {
  return layerRankOf(useContext(LayerRankContext), layer);
}

export function LayerRanksProvider({ value, children }: { value: readonly number[]; children: ReactNode }) {
  return <LayerRankContext.Provider value={value}>{children}</LayerRankContext.Provider>;
}
