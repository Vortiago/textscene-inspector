/**
 * Draws a tile layer's rendering quadrants, each a canvas item with its own light list
 * (`tile_map_layer.cpp:412-566`), as one batched mesh per run of cells that share an atlas source.
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
import { sourceRuns, type SourceRun } from './sourceRuns';
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
  const batches = useMemo(() => quadrantBatches(layer.model, quadrants), [layer.model, quadrants]);
  // Keyed by draw index: a quadrant has no identity across a re-parse that moves its cells.
  return batches.map((quadrant, drawIndex) => <TileQuadrant key={drawIndex} {...quadrant} {...layer} />);
}

/** A quadrant's runs, and the `renderOrder` of its first, which follows the previous quadrant's last. */
interface QuadrantBatches {
  runs: readonly SourceRun[];
  firstOrder: number;
}

function quadrantBatches(
  model: TileSetModel,
  quadrants: readonly (readonly PlacedCell[])[]
): QuadrantBatches[] {
  let firstOrder = 0;
  return quadrants.map((cells) => {
    const runs = sourceRuns(model, cells);
    const quadrant = { runs, firstOrder };
    firstOrder += runs.length;
    return quadrant;
  });
}

function TileQuadrant({
  runs,
  firstOrder,
  model,
  tint,
  material,
  lightMask,
  zFinal,
  name,
}: TileLayerItem & QuadrantBatches) {
  const blend = canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX);
  return (
    <LitCanvasItemPixels material={material} lightMask={lightMask} zFinal={zFinal}>
      {(lighting) =>
        runs.map(({ source, cells }, runIndex) => (
          <TileSourceMesh
            key={runIndex}
            source={source}
            cells={cells}
            grid={model}
            renderOrder={firstOrder + runIndex}
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
