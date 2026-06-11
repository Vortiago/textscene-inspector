/**
 * Batched tile geometry — one merged quad set per atlas source, as plain typed
 * arrays (no THREE): 4 vertices / 6 indices per cell, positions in three-local
 * space (Godot pixels with Y negated once — the node group is conjugated, see
 * node2dTransform), per-cell UVs windowed to the atlas region.
 *
 * UV convention matches r3f/spriteFrame.ts: textures load with flipY=true, so
 * image-Y (top-left origin) maps to UV-Y (bottom-left) via v = 1 − y/texH.
 * spriteFrame windows by mutating texture.repeat/offset (one window per cloned
 * texture); here windows live in geometry attributes because every cell shares
 * one identity-cached texture.
 */

import { mapToLocalPx } from './tilePlacement';
import type { AtlasSourceModel, TileGrid, Vec2i } from './tileSetModel';

/** The slice of a placed cell the builder needs (structurally matches PlacedCell). */
export interface DrawableCell {
  coords: Vec2i;
  atlasCoords: Vec2i;
  alternativeId: number;
}

export interface TileGeometryArrays {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface UvRect {
  u0: number;
  u1: number;
  vTop: number;
  vBottom: number;
}

/** Pixel rect (image-Y top-left) → UV rect under the flipY=true convention. */
export function pxRectToUv(
  rect: { x: number; y: number; width: number; height: number },
  texW: number,
  texH: number
): UvRect {
  return {
    u0: rect.x / texW,
    u1: (rect.x + rect.width) / texW,
    vTop: 1 - rect.y / texH,
    vBottom: 1 - (rect.y + rect.height) / texH,
  };
}

export function buildTileGeometryArrays(
  cells: readonly DrawableCell[],
  source: AtlasSourceModel,
  grid: TileGrid,
  texW: number,
  texH: number
): TileGeometryArrays {
  const positions = new Float32Array(cells.length * 4 * 3);
  const uvs = new Float32Array(cells.length * 4 * 2);
  const indices = new Uint32Array(cells.length * 6);

  cells.forEach((cell, i) => {
    const center = mapToLocalPx(grid, cell.coords);
    const w = source.textureRegionSize.x;
    const h = source.textureRegionSize.y;

    const regionPx = {
      x: source.margins.x + cell.atlasCoords.x * (source.textureRegionSize.x + source.separation.x),
      y: source.margins.y + cell.atlasCoords.y * (source.textureRegionSize.y + source.separation.y),
      width: w,
      height: h,
    };
    const uv = pxRectToUv(regionPx, texW, texH);

    // Corner order TL, TR, BL, BR — positions in three-local space (Y negated;
    // `0 - v` so a zero stays +0, never -0).
    const left = center.x - w / 2;
    const right = center.x + w / 2;
    const top = 0 - (center.y - h / 2);
    const bottom = 0 - (center.y + h / 2);
    positions.set([left, top, 0, right, top, 0, left, bottom, 0, right, bottom, 0], i * 12);
    uvs.set([uv.u0, uv.vTop, uv.u1, uv.vTop, uv.u0, uv.vBottom, uv.u1, uv.vBottom], i * 8);

    const v = i * 4;
    indices.set([v + 2, v + 3, v, v + 3, v + 1, v], i * 6);
  });

  return { positions, uvs, indices };
}
