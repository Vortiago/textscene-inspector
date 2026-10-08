/**
 * Draws a tile layer's rendering quadrants, each a canvas item with its own light list
 * (`tile_map_layer.cpp:412-566`), as one batched mesh per atlas source.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { TileSetModel } from '../resources/tileset/types';
import { canvasItemBlendState } from '../resources/materials/canvasitemmaterial/renderer';
import {
  CanvasItemBlendMode,
  type CanvasItemMaterialProperties,
} from '../resources/materials/canvasitemmaterial/types';
import { LitCanvasItemPixels } from './components/LitCanvasItemPixels';
import { drawnSources } from './drawnSources';
import { TileSourceMesh } from './TileSourceMesh';

interface TileLayerItem {
  model: TileSetModel;
  /** The layer's own-pixel tint (linear space). */
  tint: { color: THREE.Color; opacity: number };
  material: CanvasItemMaterialProperties | null;
  lightMask: number | undefined;
  zFinal: number;
  /** Group name for a source's missing-texture placeholder. */
  name: string;
}

export interface TileQuadrantsProps extends TileLayerItem {
  /** The cells of each quadrant, in draw order (`layerQuadrants`). */
  quadrants: readonly (readonly PlacedCell[])[];
}

export function TileQuadrants({ quadrants, ...layer }: TileQuadrantsProps) {
  // Keyed by draw index: a quadrant has no identity across a re-parse that moves its cells.
  return quadrants.map((cells, drawIndex) => (
    <TileQuadrant key={drawIndex} cells={cells} drawIndex={drawIndex} {...layer} />
  ));
}

function TileQuadrant({
  cells,
  drawIndex,
  model,
  tint,
  material,
  lightMask,
  zFinal,
  name,
}: TileLayerItem & { cells: readonly PlacedCell[]; drawIndex: number }) {
  const sources = useMemo(() => drawnSources(model, cells), [model, cells]);
  // A stride of the tileset's source count keeps each quadrant's batches after the previous one's.
  const firstOrder = drawIndex * model.sourceOrder.length;
  const blend = canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX);
  return (
    <LitCanvasItemPixels material={material} lightMask={lightMask} zFinal={zFinal}>
      {(lighting) =>
        sources.map(({ sourceId, sourceIndex, source, cells: sourceCells }) => (
          <TileSourceMesh
            key={sourceId}
            source={source}
            cells={sourceCells}
            grid={model}
            renderOrder={firstOrder + sourceIndex}
            color={tint.color}
            opacity={tint.opacity}
            name={name}
            blend={blend}
            lighting={lighting}
          />
        ))
      }
    </LitCanvasItemPixels>
  );
}
