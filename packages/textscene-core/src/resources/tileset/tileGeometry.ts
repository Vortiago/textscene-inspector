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
import { tileDrawInfo, type AtlasSourceModel, type TileGrid, type Vec2i } from './tileSetModel';

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
    const info = tileDrawInfo(source, cell.atlasCoords, cell.alternativeId);
    const { flipH, flipV, transpose } = info.orientation;
    // Transposed tiles draw with swapped dimensions (Godot swaps the dest rect).
    const w = transpose ? info.regionPx.height : info.regionPx.width;
    const h = transpose ? info.regionPx.width : info.regionPx.height;
    const uv = pxRectToUv(info.regionPx, texW, texH);

    // Corner UV grid [[TL,TR],[BL,BR]]; transpose reflects across the main
    // diagonal, then flips swap columns/rows (Godot composes in that order).
    let corners: [number, number][][] = [
      [[uv.u0, uv.vTop], [uv.u1, uv.vTop]],
      [[uv.u0, uv.vBottom], [uv.u1, uv.vBottom]],
    ];
    if (transpose) {
      corners = [
        [corners[0]![0]!, corners[1]![0]!],
        [corners[0]![1]!, corners[1]![1]!],
      ];
    }
    if (flipH) corners = corners.map((row) => [row[1]!, row[0]!]);
    if (flipV) corners = [corners[1]!, corners[0]!];

    // Quad center = map_to_local − texture_origin (Godot's draw_tile anchor).
    const cx = center.x - info.textureOrigin.x;
    const cy = center.y - info.textureOrigin.y;
    // Corner order TL, TR, BL, BR — positions in three-local space (Y negated;
    // `0 - v` so a zero stays +0, never -0).
    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = 0 - (cy - h / 2);
    const bottom = 0 - (cy + h / 2);
    positions.set([left, top, 0, right, top, 0, left, bottom, 0, right, bottom, 0], i * 12);
    uvs.set(
      [...corners[0]![0]!, ...corners[0]![1]!, ...corners[1]![0]!, ...corners[1]![1]!],
      i * 8
    );

    const v = i * 4;
    indices.set([v + 2, v + 3, v, v + 3, v + 1, v], i * 6);
  });

  return { positions, uvs, indices };
}
