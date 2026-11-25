/**
 * Draws a tile layer's rendering quadrants (`tile_map_layer.cpp:412-566`). Each quadrant is one
 * canvas item per run of tiles that share a material and `z_index` (`:313-376`), each with its own
 * light list, as one batched mesh per run of cells that share an atlas source.
 */

import { useMemo } from 'react';
import type { RenderingQuadrant } from '../resources/tileset/renderingQuadrants';
import type { TileMaterial, TileSetModel } from '../resources/tileset/types';
import { quadrantCanvasItems, type TileCanvasItem } from '../resources/tileset/tileCanvasItems';
import type { CanvasItemMaterialProperties } from '../resources/materials/canvasitemmaterial/types';
import { LitCanvasItem } from './components/LitCanvasItemPixels';
import { CanvasItemGroup, useCanvasItemKey } from './components/CanvasItemGroup';
import type * as THREE from 'three';
import { foldOwnPixelTint, WHITE_MODULATE } from './canvasItemModulate';
import { useCanvasModulateFor } from './canvasModulate';
import { useCanvasColorSpace, type CanvasColorSpace } from './canvasColorSpace';
import { useGodotLinearColor } from './godotColor';
import { childCanvasPlace } from './canvasItemState';
import { TileSourceMesh, type TileTint } from './TileSourceMesh';
import type { CanvasItemTextureSampler } from './canvasItemTextureSampler';
import type { Rgba } from '../godot/math/math';
import type { ShaderText } from '../resources/materials/shadermaterial/types';
import { TileShaderRun } from './canvasShader/TileShaderRun';

interface TileLayerItem {
  model: TileSetModel;
  /**
   * The layer's own-pixel modulate in sRGB, before the canvas tint: each item's material decides
   * whether the canvas tint reaches it.
   */
  selfTint: Rgba;
  /** The layer's material, which a tile with no material of its own draws with. */
  material: CanvasItemMaterialProperties | null;
  /** The layer's canvas_item shader, which a tile with no material of its own draws with. */
  shader: ShaderText | null;
  lightMask: number | undefined;
  zFinal: number;
  /** The layer's effective filter and repeat, which its atlas textures sample with. */
  sampler: CanvasItemTextureSampler;
}

interface TileQuadrantsProps extends TileLayerItem {
  /** The layer's rendering quadrants, in draw order (`layerQuadrants`). */
  quadrants: readonly RenderingQuadrant[];
}

/** Draws inside the layer's canvas key (`useCanvasItemKey`), from which a tile `z_index` moves an item. */
export function TileQuadrants({ quadrants, ...layer }: TileQuadrantsProps) {
  const items = useMemo(() => drawnItems(quadrants), [quadrants]);
  // Keyed by draw index: an item has no identity across a re-parse that moves its cells.
  return items.map((item, drawIndex) => <TileItem key={drawIndex} item={item} layer={layer} />);
}

/** A canvas item, its quadrant's origin, and its first batch's `renderOrder`, after the last item's. */
interface DrawnItem extends TileCanvasItem {
  canvasItemsPosition: RenderingQuadrant['canvasItemsPosition'];
  firstOrder: number;
}

function drawnItems(quadrants: readonly RenderingQuadrant[]): DrawnItem[] {
  let firstOrder = 0;
  const items = quadrants.flatMap(({ canvasItemsPosition, cells }) =>
    quadrantCanvasItems(cells).map((item) => ({ ...item, canvasItemsPosition }))
  );
  return items.map((item) => {
    const drawn = { ...item, firstOrder };
    firstOrder += item.runs.length;
    return drawn;
  });
}

/**
 * Where a tile item's tint goes. A tile draws a rect, which converts `modulate × tint` to linear as
 * one product (`renderer_canvas_render_rd.cpp:2425-2428`). A linear canvas decodes the vertex
 * colours apart, so the tint goes into them and the material carries the canvas modulate alone.
 */
function tileTint(
  self: Rgba,
  canvasModulate: Rgba,
  linearModulate: THREE.Color,
  space: CanvasColorSpace
): TileTint {
  const { own, color, opacity } = foldOwnPixelTint(self, canvasModulate, space, linearModulate);
  return space.isLinear
    ? { vertex: own, color: linearModulate, opacity }
    : { vertex: WHITE_MODULATE, color, opacity };
}

function TileItem({ item, layer }: { item: DrawnItem; layer: TileLayerItem }) {
  const material = tileItemMaterial(item.material, layer.material);
  const shader = item.material ? item.material.shader : layer.shader;
  const tileSet = useMemo(
    () => ({ grid: layer.model, usesUvClipping: layer.model.usesUvClipping }),
    [layer.model]
  );
  const { key: canvasKey, zFinal } = childCanvasPlace(
    { key: useCanvasItemKey(), zFinal: layer.zFinal },
    item.zIndex
  );
  const canvasModulate = useCanvasModulateFor(material);
  const linearModulate = useGodotLinearColor(canvasModulate);
  const space = useCanvasColorSpace();
  // Memoised on the values: a legacy TileMap layer hands a fresh `selfTint` on every render.
  const { r, g, b, a } = layer.selfTint;
  const selfTint = useMemo(() => ({ r, g, b, a }), [r, g, b, a]);
  const tint = useMemo(
    () => tileTint(selfTint, canvasModulate, linearModulate, space),
    [selfTint, canvasModulate, linearModulate, space]
  );
  return (
    <CanvasItemGroup renderOrder={canvasKey}>
      <LitCanvasItem material={material} lightMask={layer.lightMask} zFinal={zFinal}>
        {item.runs.map(({ source, cells }, runIndex) => {
          const mesh = (
            <TileSourceMesh
              key={runIndex}
              source={source}
              cells={cells}
              grid={layer.model}
              renderOrder={item.firstOrder + runIndex}
              tint={tint}
              sampler={layer.sampler}
            />
          );
          if (!shader) return mesh;
          return (
            <TileShaderRun
              key={runIndex}
              shader={shader}
              source={source}
              cells={cells}
              tileSet={tileSet}
              finalModulate={selfTint}
              itemOrigin={item.canvasItemsPosition}
              sampler={layer.sampler}
              renderOrder={item.firstOrder + runIndex}
              fallback={mesh}
            />
          );
        })}
      </LitCanvasItem>
    </CanvasItemGroup>
  );
}

/** A tile's own material replaces the layer's: the item stops `use_parent_material` (`:350`). */
function tileItemMaterial(
  own: TileMaterial | null,
  layerMaterial: CanvasItemMaterialProperties | null
): CanvasItemMaterialProperties | null {
  return own ? own.properties : layerMaterial;
}
