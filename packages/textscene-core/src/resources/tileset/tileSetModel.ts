/**
 * Normalized TileSet domain types — the pure data model shared by the tile
 * slices (TileMap / TileMapLayer), the TileSet resolver, and the placement /
 * geometry math. No React, no THREE (linter- and parser-closure safe).
 */

export interface Vec2i {
  x: number;
  y: number;
}

/** TileSet.tile_shape — only square and isometric render in V1 (ADR-0008 fallback otherwise). */
export const TILE_SHAPE_SQUARE = 0;
export const TILE_SHAPE_ISOMETRIC = 1;

/** TileSet.tile_layout (half-offset shapes): STACKED .. DIAMOND_DOWN. */
export type TileLayout = 0 | 1 | 2 | 3 | 4 | 5;
/** TileSet.tile_offset_axis: 0 = horizontal (V1), 1 = vertical (fallback). */
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
  /** Source ids in appearance order — deterministic within-layer draw order. */
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
