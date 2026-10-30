import { SCENE_ROW_TEXELS } from '../sceneRows/sceneRowTexels.js';

/**
 * Where each part of a decal sits in its row of the scene rows, in texels. `decalRows.ts` writes the
 * row and `decalShaderChunk.ts` reads it, both through this table.
 */

/** The texel of each map's atlas rectangle in a decal's row. */
export const RECT_TEXEL = { albedo: 4, normal: 5, orm: 6, emission: 7 } as const;

/** The four textures of a Decal, each an entry of the decal atlas. */
export type DecalMap = keyof typeof RECT_TEXEL;

export const DECAL_MAPS = Object.keys(RECT_TEXEL) as readonly DecalMap[];

/**
 * The texels of a decal's row. `toDecal` holds the rows of the matrix from a view-space point to the
 * box coordinates, and `up` the decal's up axis in view space with `normal_fade` in w. Each rectangle
 * is the map's place in the atlas, all zero for a map the decal lacks. `modulate` is linear, its alpha
 * times the distance fade. `maskAndFades` holds the two 16-bit halves of `cull_mask`, then
 * `upper_fade` and `lower_fade`. `energyAndMix` holds `emission_energy` times the distance fade, then
 * `albedo_mix`. `normalBasis` holds the columns of the decal's orthonormalised basis in view space: its last three
 * texels, so it ends the row.
 */
export const DECAL_TEXEL = {
  toDecal: 0,
  up: 3,
  albedoRect: RECT_TEXEL.albedo,
  normalRect: RECT_TEXEL.normal,
  ormRect: RECT_TEXEL.orm,
  emissionRect: RECT_TEXEL.emission,
  modulate: 8,
  maskAndFades: 9,
  energyAndMix: 10,
  normalBasis: SCENE_ROW_TEXELS - 3,
} as const;
