import type { Rect2 } from '../../godot/math/rect2';
import type { Vector2 } from '../../godot/math/vector';
import type { DrawableCell } from '../../resources/tileset/drawableCell';
import { paddedTileRegion } from '../../resources/tileset/paddedAtlas';
import { mapToLocalPx } from '../../resources/tileset/tilePlacement';
import {
  tileDrawInfo,
  type TileDrawInfo,
  type TileGrid,
  type TileSetModel,
} from '../../resources/tileset/types';
import type { CanvasShaderCommand } from './canvasCommands';

/** `TileMapLayer::FP_ADJUST` (`tile_map_layer.h:385`). */
const FP_ADJUST = 0.00001;

/** What the tile draw reads from the layer's TileSet. */
export type TileSetDraw = TileGrid & Pick<TileSetModel, 'usesUvClipping'>;

/** The rect of each cell, frame 0, in the pixels of the item at `itemOrigin` (`tile_map_layer.cpp:384`). */
export function tileRectCommands(
  cells: readonly DrawableCell[],
  tileSet: TileSetDraw,
  itemOrigin: Vector2
): CanvasShaderCommand[] {
  return cells.map((cell) => {
    const drawn = tileDrawInfo(cell.source, cell);
    const region = drawn.regionPx;
    const runtime = cell.source.usesTexturePadding
      ? paddedTileRegion(cell.source, cell.atlasCoords, region)
      : region;
    const local = mapToLocalPx(tileSet, cell.coords);
    const position = { x: local.x - itemOrigin.x, y: local.y - itemOrigin.y };
    return {
      kind: 'rect',
      region: {
        rect: transformedDestRect(drawn, position, { x: region.width, y: region.height }),
        source: { x: runtime.x, y: runtime.y, w: runtime.width, h: runtime.height },
        clipUv: tileSet.usesUvClipping,
        transpose: drawn.orientation.transpose,
      },
      modulate: cell.tileData.modulate,
    };
  });
}

/** `compute_transformed_tile_dest_rect` (`tile_map_layer.cpp:2727-2775`), the size left untransposed. */
function transformedDestRect(
  { orientation: { flipH, flipV, transpose }, centreOffset }: TileDrawInfo,
  position: Vector2,
  size: Vector2
): Rect2 {
  const w = size.x + FP_ADJUST;
  const h = size.y + FP_ADJUST;
  const placed = transpose ? { x: h, y: w } : { x: w, y: h };
  const x = -0.5 * placed.x + centreOffset.x + position.x;
  const y = -0.5 * placed.y + centreOffset.y + position.y;
  return { x, y, w: flipH ? -w : w, h: flipV ? -h : h };
}
