import type { Rect2 } from '../../godot/math/rect2';
import type { Vector2 } from '../../godot/math/vector';
import {
  TILE_TRANSFORM_FLIP_H,
  TILE_TRANSFORM_FLIP_V,
  TILE_TRANSFORM_TRANSPOSE,
} from '../../godot/scene/tileSet';
import type { DrawableCell } from '../../resources/tileset/drawableCell';
import { paddedTileRegion } from '../../resources/tileset/paddedAtlas';
import { mapToLocalPx } from '../../resources/tileset/tilePlacement';
import { atlasTileRegion, type TileGrid } from '../../resources/tileset/types';
import type { CanvasShaderCommand } from './canvasCommands';

/** `TileMapLayer::FP_ADJUST` (`tile_map_layer.h:385`). */
const FP_ADJUST = 0.00001;

/** What the tile draw reads from the layer's TileSet. */
export interface TileSetDraw {
  readonly grid: TileGrid;
  readonly usesUvClipping: boolean;
}

/** The rect of each cell, frame 0, in the pixels of the item at `itemOrigin` (`tile_map_layer.cpp:384`). */
export function tileRectCommands(
  cells: readonly DrawableCell[],
  tileSet: TileSetDraw,
  itemOrigin: Vector2
): CanvasShaderCommand[] {
  return cells.map((cell) => {
    const region = atlasTileRegion(cell.source, cell.atlasCoords, cell.tile.sizeInAtlas);
    const runtime = cell.source.usesTexturePadding
      ? paddedTileRegion(cell.source, cell.atlasCoords, region)
      : region;
    const local = mapToLocalPx(tileSet.grid, cell.coords);
    const position = { x: local.x - itemOrigin.x, y: local.y - itemOrigin.y };
    const { rect, transpose } = transformedDestRect(cell, position, {
      x: region.width,
      y: region.height,
    });
    return {
      kind: 'rect',
      region: {
        rect,
        source: { x: runtime.x, y: runtime.y, w: runtime.width, h: runtime.height },
        clipUv: tileSet.usesUvClipping,
        transpose,
      },
      modulate: cell.tileData.modulate,
    };
  });
}

/** `compute_transformed_tile_dest_rect` (`tile_map_layer.cpp:2727-2775`), the size left untransposed. */
function transformedDestRect(
  { alternativeId, tileData }: DrawableCell,
  position: Vector2,
  size: Vector2
): { rect: Rect2; transpose: boolean } {
  const cellTranspose = (alternativeId & TILE_TRANSFORM_TRANSPOSE) !== 0;
  const cellFlipH = (alternativeId & TILE_TRANSFORM_FLIP_H) !== 0;
  const cellFlipV = (alternativeId & TILE_TRANSFORM_FLIP_V) !== 0;
  const transpose = tileData.transpose !== cellTranspose;
  const flipH = cellFlipH !== (cellTranspose ? tileData.flipV : tileData.flipH);
  const flipV = cellFlipV !== (cellTranspose ? tileData.flipH : tileData.flipV);
  const w = size.x + FP_ADJUST;
  const h = size.y + FP_ADJUST;
  const placed = transpose ? { x: h, y: w } : { x: w, y: h };
  const origin = cellTranspose
    ? { x: tileData.textureOrigin.y, y: tileData.textureOrigin.x }
    : tileData.textureOrigin;
  let x = -0.5 * placed.x - origin.x;
  let y = -0.5 * placed.y - origin.y;
  if (cellFlipH) x = -(x + placed.x);
  if (cellFlipV) y = -(y + placed.y);
  return { rect: { x: x + position.x, y: y + position.y, w: flipH ? -w : w, h: flipV ? -h : h }, transpose };
}
