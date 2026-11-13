/**
 * The bits of a tile vertex's orientation, which the tile geometry writes and the normal-mapped
 * lighting program reads. A leaf module, so the lighting imports no tile geometry.
 */

export const TILE_ORIENTATION_FLIP_H = 1;
export const TILE_ORIENTATION_FLIP_V = 2;
export const TILE_ORIENTATION_TRANSPOSE = 4;
