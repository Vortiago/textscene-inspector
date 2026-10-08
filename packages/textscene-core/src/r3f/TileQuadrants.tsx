/**
 * Draws a tile layer's rendering quadrants (`tile_map_layer.cpp:412-566`). Each quadrant is one
 * canvas item per run of tiles that share a material and `z_index` (`:313-376`), each with its own
 * light list, as one batched mesh per run of cells that share an atlas source.
 */

import { useMemo } from 'react';
import type { DrawableCell } from '../resources/tileset/drawableCell';
import type { TileMaterial, TileSetModel } from '../resources/tileset/types';
import { quadrantCanvasItems, type TileCanvasItem } from '../resources/tileset/tileCanvasItems';
import { canvasItemBlendState } from '../resources/materials/canvasitemmaterial/renderer';
import {
  CanvasItemBlendMode,
  type CanvasItemMaterialProperties,
} from '../resources/materials/canvasitemmaterial/types';
import { LitCanvasItemPixels } from './components/LitCanvasItemPixels';
import { CanvasItemGroup, useCanvasItemKey } from './components/CanvasItemGroup';
import { useCanvasItemMaterialFile } from './components/canvasItemMaterialContext';
import { multiplyModulate, type RGBA } from './canvasItemModulate';
import { useCanvasModulateFor } from './canvasModulate';
import { useGodotLinearColor } from './godotColor';
import { canvasKeyAtZ } from './canvasPaintOrder';
import { accumulateCanvasItemZ } from './lighting2d/canvasItemPlacement';
import { TileSourceMesh } from './TileSourceMesh';

interface TileLayerItem {
  model: TileSetModel;
  /**
   * The layer's own-pixel modulate in sRGB, before the canvas tint: each item's material decides
   * whether the canvas tint reaches it.
   */
  selfTint: RGBA;
  /** The layer's material, which a tile with no material of its own draws with. */
  material: CanvasItemMaterialProperties | null;
  lightMask: number | undefined;
  zFinal: number;
  /** Group name for a source's missing-texture placeholder. */
  name: string;
}

interface TileQuadrantsProps extends TileLayerItem {
  /** The drawable cells of each quadrant, in draw order (`layerQuadrants`). */
  quadrants: readonly (readonly DrawableCell[])[];
}

/** Draws inside the layer's canvas key (`useCanvasItemKey`), from which a tile `z_index` moves an item. */
export function TileQuadrants({ quadrants, ...layer }: TileQuadrantsProps) {
  const items = useMemo(() => drawnItems(quadrants), [quadrants]);
  // Keyed by draw index: an item has no identity across a re-parse that moves its cells.
  return items.map((item, drawIndex) => <TileItem key={drawIndex} item={item} layer={layer} />);
}

/** A canvas item, and the `renderOrder` of its first batch, which follows the previous item's last. */
interface DrawnItem extends TileCanvasItem {
  firstOrder: number;
}

function drawnItems(quadrants: readonly (readonly DrawableCell[])[]): DrawnItem[] {
  let firstOrder = 0;
  return quadrants.flatMap(quadrantCanvasItems).map((item) => {
    const drawn = { ...item, firstOrder };
    firstOrder += item.runs.length;
    return drawn;
  });
}

function TileItem({ item, layer }: { item: DrawnItem; layer: TileLayerItem }) {
  const material = useTileItemMaterial(item.material, layer.material);
  // `z_as_relative` (`:356`), so the item's z accumulates onto the layer's.
  const zFinal = accumulateCanvasItemZ(layer.zFinal, { z_index: item.zIndex });
  const canvasKey = canvasKeyAtZ(useCanvasItemKey(), layer.zFinal, zFinal);
  const own = multiplyModulate(layer.selfTint, useCanvasModulateFor(material));
  const color = useGodotLinearColor(own);
  const blend = canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX);
  return (
    <CanvasItemGroup renderOrder={canvasKey}>
      <LitCanvasItemPixels material={material} lightMask={layer.lightMask} zFinal={zFinal}>
        {(lighting) =>
          item.runs.map(({ source, cells }, runIndex) => (
            <TileSourceMesh
              key={runIndex}
              source={source}
              cells={cells}
              grid={layer.model}
              renderOrder={item.firstOrder + runIndex}
              color={color}
              opacity={own.a}
              name={layer.name}
              blend={blend}
              lighting={lighting}
            />
          ))
        }
      </LitCanvasItemPixels>
    </CanvasItemGroup>
  );
}

/** A tile's own material replaces the layer's: the item stops `use_parent_material` (`:350`). */
function useTileItemMaterial(
  own: TileMaterial | null,
  layerMaterial: CanvasItemMaterialProperties | null
): CanvasItemMaterialProperties | null {
  const fromFile = useCanvasItemMaterialFile(own && 'path' in own ? own.path : null);
  if (!own) return layerMaterial;
  return 'path' in own ? fromFile : own.properties;
}
