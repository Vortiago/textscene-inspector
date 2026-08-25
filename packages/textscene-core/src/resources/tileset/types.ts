/**
 * The TileSet slice's types — the pure data model shared by the tile node
 * slices (TileMap / TileMapLayer), this slice's decode, and the placement /
 * geometry math. No React, no THREE (linter- and parser-closure safe).
 *
 * Carries the model's own lookup helper (`tileDrawInfo`) and enum constants
 * alongside the shapes: they are the meaning of the data, and splitting them
 * off would leave a consumer holding the types unable to read them.
 */

export interface Vec2i {
  x: number;
  y: number;
}

/** TileSet.tile_shape — square, isometric, half-offset square, and hexagon all render. */
export const TILE_SHAPE_SQUARE = 0;
export const TILE_SHAPE_ISOMETRIC = 1;
export const TILE_SHAPE_HALF_OFFSET_SQUARE = 2;
export const TILE_SHAPE_HEXAGON = 3;

/** TileSet.tile_layout (half-offset shapes): STACKED .. DIAMOND_DOWN. */
export type TileLayout = 0 | 1 | 2 | 3 | 4 | 5;
/** TileSet.tile_offset_axis: 0 = horizontal, 1 = vertical. */
export type TileOffsetAxis = 0 | 1;

/** The grid surface of a TileSet that placement math needs. */
export interface TileGrid {
  shape: number;
  layout: TileLayout;
  offsetAxis: TileOffsetAxis;
  tileSize: Vec2i;
}

/** A resolved TileSet: grid shape plus its atlas sources, ready for pure lookups. */
export interface TileSetModel extends TileGrid {
  /** Atlas sources keyed by their `sources/N` id. */
  sources: Map<number, AtlasSourceModel>;
  /**
   * Source ids, each once, in the order their keys appear in the file.
   *
   * This previewer's own deterministic batching order, not the engine's:
   * `add_source` keeps `source_ids` sorted ascending (tile_set.cpp:483-484) and
   * Godot draws a layer's cells interleaved in scan order rather than per
   * source at all, so there is no engine order to match — see `tileSourceZ`.
   * One entry per `sources` key, never per written spelling of one.
   */
  sourceOrder: number[];
}

export interface AtlasSourceModel {
  /** Resolved res:// texture path; null ⇒ per-source placeholder UX. */
  texturePath: string | null;
  margins: Vec2i;
  separation: Vec2i;
  textureRegionSize: Vec2i;
  /** Per-tile entries keyed `${atlasX}:${atlasY}`. */
  tiles: Map<string, AtlasTileModel>;
}

export interface AtlasTileModel {
  sizeInAtlas: Vec2i;
  /** Alternative tiles keyed by alternative id; 0 = the base tile. */
  alternatives: Map<number, AlternativeTileModel>;
}

export interface TileOrientation {
  flipH: boolean;
  flipV: boolean;
  transpose: boolean;
}

export interface AlternativeTileModel extends TileOrientation {
  textureOrigin: Vec2i;
}

/**
 * Godot TileSetAtlasSource alternative-id transform bits: a cell painted with
 * a flip/rotate carries these bits directly in its alternative_tile value.
 */
export const TILE_TRANSFORM_FLIP_H = 0x1000;
export const TILE_TRANSFORM_FLIP_V = 0x2000;
export const TILE_TRANSFORM_TRANSPOSE = 0x4000;
const TILE_TRANSFORM_MASK = TILE_TRANSFORM_FLIP_H | TILE_TRANSFORM_FLIP_V | TILE_TRANSFORM_TRANSPOSE;

export interface TileDrawInfo {
  /** Pixel rect of the tile's texture region within the atlas (image-Y top-left). */
  regionPx: { x: number; y: number; width: number; height: number };
  orientation: TileOrientation;
  textureOrigin: Vec2i;
}

/**
 * The pure lookup from a placed cell's (atlasCoords, alternativeId) to its
 * draw info. The base alternative id (low bits) selects an authored
 * alternative tile; the high bits XOR their transforms on top (matching
 * Godot's draw_tile, where painted transform bits compose with the
 * alternative's own flip flags).
 */
export function tileDrawInfo(
  source: AtlasSourceModel,
  atlasCoords: Vec2i,
  alternativeId: number
): TileDrawInfo {
  const baseAlt = alternativeId & ~TILE_TRANSFORM_MASK;
  const tile = source.tiles.get(`${atlasCoords.x}:${atlasCoords.y}`);
  const alternative = tile?.alternatives.get(baseAlt) ?? tile?.alternatives.get(0);

  const sizeInAtlas = tile?.sizeInAtlas ?? { x: 1, y: 1 };
  const stepX = source.textureRegionSize.x + source.separation.x;
  const stepY = source.textureRegionSize.y + source.separation.y;

  return {
    regionPx: {
      x: source.margins.x + atlasCoords.x * stepX,
      y: source.margins.y + atlasCoords.y * stepY,
      width: source.textureRegionSize.x * sizeInAtlas.x + source.separation.x * (sizeInAtlas.x - 1),
      height: source.textureRegionSize.y * sizeInAtlas.y + source.separation.y * (sizeInAtlas.y - 1),
    },
    orientation: {
      flipH: (alternative?.flipH ?? false) !== ((alternativeId & TILE_TRANSFORM_FLIP_H) !== 0),
      flipV: (alternative?.flipV ?? false) !== ((alternativeId & TILE_TRANSFORM_FLIP_V) !== 0),
      transpose:
        (alternative?.transpose ?? false) !== ((alternativeId & TILE_TRANSFORM_TRANSPOSE) !== 0),
    },
    textureOrigin: alternative?.textureOrigin ?? { x: 0, y: 0 },
  };
}
