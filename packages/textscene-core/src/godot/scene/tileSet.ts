/** Godot 4.6.3's `TileSetAtlasSource` facts a scene's tile data carries. */

/**
 * `TileSetAtlasSource::TransformBits` (`scene/resources/2d/tile_set.h:628-632`): a cell painted
 * with a flip or a rotation carries these bits in its alternative tile id.
 */
export const TILE_TRANSFORM_FLIP_H = 1 << 12;
export const TILE_TRANSFORM_FLIP_V = 1 << 13;
export const TILE_TRANSFORM_TRANSPOSE = 1 << 14;
