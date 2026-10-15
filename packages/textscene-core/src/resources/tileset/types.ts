/**
 * The TileSet data model shared by the tile node slices, this slice's decode and the placement
 * and geometry math, free of React and THREE. It carries `tileDrawInfo` and the enum constants
 * beside the shapes, since a consumer holding the types needs them to read the data.
 */

import type { CanvasItemMaterialProperties } from '../materials/canvasitemmaterial/types';
import type { DrawableCell } from './drawableCell';
import type { Rgba } from '../../godot/math';
import type { Vector2 } from '../../godot/vector';

/** TileSet.tile_shape: square, isometric, half-offset square and hexagon all render. */
export const TILE_SHAPE_SQUARE = 0;
export const TILE_SHAPE_ISOMETRIC = 1;
export const TILE_SHAPE_HALF_OFFSET_SQUARE = 2;
export const TILE_SHAPE_HEXAGON = 3;

/** TileSet.tile_layout (half-offset shapes): STACKED .. DIAMOND_DOWN. */
type TileLayout = 0 | 1 | 2 | 3 | 4 | 5;
/** TileSet.tile_offset_axis: 0 = horizontal, 1 = vertical. */
type TileOffsetAxis = 0 | 1;

/** The grid surface of a TileSet that placement math needs. */
export interface TileGrid {
  shape: number;
  layout: TileLayout;
  offsetAxis: TileOffsetAxis;
  tileSize: Vector2;
}

/** A resolved TileSet: grid shape plus its atlas sources, ready for pure lookups. */
export interface TileSetModel extends TileGrid {
  /** Atlas sources keyed by their `sources/N` id. */
  sources: Map<number, AtlasSourceModel>;
}

export interface AtlasSourceModel {
  /** Resolved res:// texture path; null ⇒ per-source placeholder UX. */
  texturePath: string | null;
  margins: Vector2;
  separation: Vector2;
  textureRegionSize: Vector2;
  /** `use_texture_padding`: the draw samples a copy of the atlas with each tile's edge repeated around it. */
  usesTexturePadding: boolean;
  /** Per-tile entries keyed `${atlasX}:${atlasY}`. */
  tiles: Map<string, AtlasTileModel>;
}

export interface AtlasTileModel {
  sizeInAtlas: Vector2;
  /** Alternative tiles keyed by alternative id; 0 = the base tile. */
  alternatives: Map<number, AlternativeTileModel>;
}

interface TileOrientation {
  flipH: boolean;
  flipV: boolean;
  transpose: boolean;
}

/**
 * A tile's own material (`TileData.material`): a SubResource's properties, or the path of the file
 * the draw loads. Tiles that name one resource share one object, so identity compares as Godot's
 * `Ref` does.
 */
export type TileMaterial =
  | {
      /** Null for a material that is not a CanvasItemMaterial, which draws with plain canvas blending. */
      properties: CanvasItemMaterialProperties | null;
    }
  | { path: string };

/** One alternative tile's `TileData`, the per-tile properties that change a frame. */
export interface AlternativeTileModel extends TileOrientation {
  textureOrigin: Vector2;
  /** sRGB, multiplied onto the tile's pixels (`tile_map_layer.cpp:2690`). */
  modulate: Rgba;
  /** Null for no material: the tile then uses its layer's (`tile_map_layer.cpp:350`). */
  material: TileMaterial | null;
  /** Relative to the layer's `z_final` (`tile_map_layer.cpp:356-357`). */
  zIndex: number;
  /** Added to the row key of a y-sorted layer (`tile_map_layer.cpp:547`). */
  ySortOrigin: number;
}

/**
 * Godot TileSetAtlasSource alternative-id transform bits: a cell painted with
 * a flip/rotate carries these bits directly in its alternative_tile value.
 */
export const TILE_TRANSFORM_FLIP_H = 0x1000;
export const TILE_TRANSFORM_FLIP_V = 0x2000;
export const TILE_TRANSFORM_TRANSPOSE = 0x4000;
const TILE_TRANSFORM_MASK = TILE_TRANSFORM_FLIP_H | TILE_TRANSFORM_FLIP_V | TILE_TRANSFORM_TRANSPOSE;

/** The authored alternative a cell's id names, its transform bits cleared (`tile_set.cpp:5320-5322`). */
export function alternativeNoTransform(alternativeId: number): number {
  return alternativeId & ~TILE_TRANSFORM_MASK;
}

/** A tile's pixel rect in the atlas image, frame 0 (`get_tile_texture_region`, `tile_set.cpp:5283-5296`). */
function atlasTileRegion(
  source: Pick<AtlasSourceModel, 'margins' | 'separation' | 'textureRegionSize'>,
  atlasCoords: Vector2,
  sizeInAtlas: Vector2
): TileDrawInfo['regionPx'] {
  const { margins, separation, textureRegionSize: region } = source;
  return {
    x: margins.x + atlasCoords.x * (region.x + separation.x),
    y: margins.y + atlasCoords.y * (region.y + separation.y),
    width: region.x * sizeInAtlas.x + separation.x * (sizeInAtlas.x - 1),
    height: region.y * sizeInAtlas.y + separation.y * (sizeInAtlas.y - 1),
  };
}

interface TileDrawInfo {
  /** Pixel rect of the tile's texture region within the atlas (image-Y top-left). */
  regionPx: { x: number; y: number; width: number; height: number };
  orientation: TileOrientation;
  /** Where the tile's centre sits from its cell's centre, in Godot pixels. */
  centreOffset: Vector2;
}

/**
 * A drawable cell's draw info. The cell's transform bits compose with its tile's own, transposed
 * first, and move the texture origin with them, as `compute_transformed_tile_dest_rect` does
 * (`tile_map_layer.cpp:2727-2774`).
 */
export function tileDrawInfo(
  source: AtlasSourceModel,
  cell: Pick<DrawableCell, 'atlasCoords' | 'alternativeId' | 'tile' | 'tileData'>
): TileDrawInfo {
  const { atlasCoords, alternativeId, tile, tileData } = cell;
  const cellTranspose = (alternativeId & TILE_TRANSFORM_TRANSPOSE) !== 0;
  const cellFlipH = (alternativeId & TILE_TRANSFORM_FLIP_H) !== 0;
  const cellFlipV = (alternativeId & TILE_TRANSFORM_FLIP_V) !== 0;
  const { textureOrigin } = tileData;
  const origin = cellTranspose ? { x: textureOrigin.y, y: textureOrigin.x } : textureOrigin;

  return {
    regionPx: atlasTileRegion(source, atlasCoords, tile.sizeInAtlas),
    orientation: {
      // A cell transpose swaps the axes the tile's own flips act on.
      flipH: cellFlipH !== (cellTranspose ? tileData.flipV : tileData.flipH),
      flipV: cellFlipV !== (cellTranspose ? tileData.flipH : tileData.flipV),
      transpose: tileData.transpose !== cellTranspose,
    },
    centreOffset: {
      x: cellFlipH ? origin.x : -origin.x,
      y: cellFlipV ? origin.y : -origin.y,
    },
  };
}

/** `TileData`'s own defaults (tile_set.h:851-858), as a fresh object a decode may fill. */
export function defaultTileData(): AlternativeTileModel {
  return {
    flipH: false,
    flipV: false,
    transpose: false,
    textureOrigin: { x: 0, y: 0 },
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    material: null,
    zIndex: 0,
    ySortOrigin: 0,
  };
}
