/**
 * Batched tile geometry: one merged quad set per run of one atlas source as plain typed arrays, 4 vertices and
 * 6 indices per cell. Positions are Godot pixels with Y negated once (the node group is conjugated,
 * see node2dTransform). UVs follow r3f/spriteFrame.ts's flipY convention, v = 1 − y/texH, but
 * window through geometry, not texture.repeat, since every cell shares one cached texture.
 */

import { mapToLocalPx } from './tilePlacement';
import type { Color } from '../../utils/colorParser';
import type { DrawableCell } from './drawableCell';
import { tileDrawInfo, type AtlasSourceModel, type TileGrid } from './types';

export interface TileGeometryArrays {
  positions: Float32Array;
  uvs: Float32Array;
  /** RGBA per vertex: the tile's `modulate` as stored, sRGB, which the draw multiplies onto its pixels. */
  colors: Float32Array;
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
  const colors = new Float32Array(cells.length * 4 * 4);
  const indices = new Uint32Array(cells.length * 6);

  cells.forEach((cell, i) => {
    const center = mapToLocalPx(grid, cell.coords);
    const info = tileDrawInfo(source, cell);
    const { flipH, flipV, transpose } = info.orientation;
    // Transposed tiles draw with swapped dimensions (Godot swaps the dest rect).
    const w = transpose ? info.regionPx.height : info.regionPx.width;
    const h = transpose ? info.regionPx.width : info.regionPx.height;
    const uv = pxRectToUv(info.regionPx, texW, texH);

    // Corner UV grid [[TL,TR],[BL,BR]]; transpose reflects across the main
    // diagonal, then flips swap columns/rows (Godot composes in that order).
    let corners: [number, number][][] = [
      [
        [uv.u0, uv.vTop],
        [uv.u1, uv.vTop],
      ],
      [
        [uv.u0, uv.vBottom],
        [uv.u1, uv.vBottom],
      ],
    ];
    if (transpose) {
      corners = [
        [corners[0]![0]!, corners[1]![0]!],
        [corners[0]![1]!, corners[1]![1]!],
      ];
    }
    if (flipH) corners = corners.map((row) => [row[1]!, row[0]!]);
    if (flipV) corners = [corners[1]!, corners[0]!];

    const cx = center.x + info.centreOffset.x;
    const cy = center.y + info.centreOffset.y;
    // Corner order TL, TR, BL, BR, with Y negated as `0 - v` so a zero stays +0, never -0.
    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = 0 - (cy - h / 2);
    const bottom = 0 - (cy + h / 2);
    positions.set([left, top, 0, right, top, 0, left, bottom, 0, right, bottom, 0], i * 12);
    uvs.set([...corners[0]![0]!, ...corners[0]![1]!, ...corners[1]![0]!, ...corners[1]![1]!], i * 8);
    writeCornerColors(colors, i * 16, cell.tileData.modulate);

    const v = i * 4;
    indices.set([v + 2, v + 3, v, v + 3, v + 1, v], i * 6);
  });

  return { positions, uvs, colors, indices };
}

/** One colour on each of a quad's four corners, from `offset`, with no array per corner. */
function writeCornerColors(colors: Float32Array, offset: number, { r, g, b, a }: Color): void {
  for (let k = offset; k < offset + 16; k += 4) {
    colors[k] = r;
    colors[k + 1] = g;
    colors[k + 2] = b;
    colors[k + 3] = a;
  }
}
