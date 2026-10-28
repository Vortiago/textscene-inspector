/**
 * Batched tile geometry: one merged quad set per run of one atlas source as plain typed arrays, 4 vertices and
 * 6 indices per cell. Positions are Godot pixels with Y negated once (the node group is conjugated,
 * see node2dTransform). UVs follow r3f/spriteFrame.ts's flipY convention, v = 1 − y/texH, but
 * window through geometry, not texture.repeat, since every cell shares one cached texture.
 */

import { mapToLocalPx } from './tilePlacement';
import type { DrawableCell } from './drawableCell';
import { tileDrawInfo, type AtlasSourceModel, type TileGrid } from './types';
import { paddedTileRegion } from './paddedAtlas';
import type { Rgba } from '../../godot/math/math';
import { regionUvRect, type UvRect } from '../../r3f/uvWindow';

interface TileGeometryArrays {
  positions: Float32Array;
  uvs: Float32Array;
  /** RGBA per vertex: the tile's `modulate` as stored, sRGB, which the draw multiplies onto its pixels. */
  colors: Float32Array;
  indices: Uint32Array;
  /**
   * Per vertex, the tile's UV rect inset by half a texel (u min, v min, u max, v max), or null for
   * a source that does not pad. A sample clamped to it reads the tile's own edge, as a sample of
   * Godot's padded atlas does (`tile_set.cpp:5622-5671`).
   */
  uvBounds: Float32Array | null;
}

type RegionPx = ReturnType<typeof tileDrawInfo>['regionPx'];

/** Geometry that samples the atlas itself, each sample of a padded source held inside its tile. */
export function buildTileGeometryArrays(
  cells: readonly DrawableCell[],
  source: AtlasSourceModel,
  grid: TileGrid,
  texW: number,
  texH: number
): TileGeometryArrays {
  return buildArrays(
    cells,
    source,
    grid,
    { x: texW, y: texH },
    {
      sampledRegion: (_cell, regionPx) => regionPx,
      hasBounds: source.usesTexturePadding,
    }
  );
}

/**
 * Geometry that samples a stand-in for a padded atlas Godot built with no image of the texture, at
 * the padded regions. The stand-in holds no tile edges, so a sample needs no bounds.
 */
export function buildPaddedStandInGeometryArrays(
  cells: readonly DrawableCell[],
  source: AtlasSourceModel,
  grid: TileGrid,
  standInW: number,
  standInH: number
): TileGeometryArrays {
  return buildArrays(
    cells,
    source,
    grid,
    { x: standInW, y: standInH },
    {
      sampledRegion: (cell, regionPx) => paddedTileRegion(source, cell.atlasCoords, regionPx),
      hasBounds: false,
    }
  );
}

interface Sampling {
  /** The pixel rect a cell samples, from its rect in the atlas. */
  sampledRegion(cell: DrawableCell, regionPx: RegionPx): RegionPx;
  hasBounds: boolean;
}

function buildArrays(
  cells: readonly DrawableCell[],
  source: AtlasSourceModel,
  grid: TileGrid,
  texSize: { x: number; y: number },
  sampling: Sampling
): TileGeometryArrays {
  const positions = new Float32Array(cells.length * 4 * 3);
  const uvs = new Float32Array(cells.length * 4 * 2);
  const colors = new Float32Array(cells.length * 4 * 4);
  const indices = new Uint32Array(cells.length * 6);
  const uvBounds = sampling.hasBounds ? new Float32Array(cells.length * 4 * 4) : null;

  cells.forEach((cell, i) => {
    const center = mapToLocalPx(grid, cell.coords);
    const info = tileDrawInfo(source, cell);
    const { flipH, flipV, transpose } = info.orientation;
    // Transposed tiles draw with swapped dimensions (Godot swaps the dest rect).
    const { x, y, width, height } = sampling.sampledRegion(cell, info.regionPx);
    const w = transpose ? height : width;
    const h = transpose ? width : height;
    const uv = regionUvRect({ x, y, w: width, h: height }, texSize);

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
    if (uvBounds) writeCornerUvBounds(uvBounds, i * 16, uv, texSize.x, texSize.y);

    const v = i * 4;
    indices.set([v + 2, v + 3, v, v + 3, v + 1, v], i * 6);
  });

  return { positions, uvs, colors, indices, uvBounds };
}

/** The UV rect inset by half a texel, on a quad's four corners. */
function writeCornerUvBounds(
  bounds: Float32Array,
  offset: number,
  uv: UvRect,
  texW: number,
  texH: number
): void {
  const halfU = 0.5 / texW;
  const halfV = 0.5 / texH;
  const rect = [uv.u0 + halfU, uv.vBottom + halfV, uv.u1 - halfU, uv.vTop - halfV];
  for (let k = offset; k < offset + 16; k += 4) bounds.set(rect, k);
}

/** One colour on each of a quad's four corners, from `offset`, with no array per corner. */
function writeCornerColors(colors: Float32Array, offset: number, { r, g, b, a }: Rgba): void {
  for (let k = offset; k < offset + 16; k += 4) {
    colors[k] = r;
    colors[k + 1] = g;
    colors[k + 2] = b;
    colors[k + 3] = a;
  }
}
