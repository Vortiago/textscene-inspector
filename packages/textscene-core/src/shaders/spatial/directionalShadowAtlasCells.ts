import {
  DIRECTIONAL_SHADOW_MAX_SPLITS,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  MAX_DIRECTIONAL_LIGHTS,
  type DirectionalShadowAtlasRect,
} from '../../godot/rendering/lights/directionalShadow.js';

/** Godot's depth of a split is `depthScales[split] * (1 - stored)`, as three stores 0 at its near plane. */
export interface DirectionalShadowAtlasShare {
  /** The light's rectangle of the atlas, in texels from the bottom left, as its viewports draw. */
  readonly rect: Readonly<DirectionalShadowAtlasRect>;
  readonly splitCount: number;
  readonly depthScales: ArrayLike<number>;
}

/** The cell of the grid that `rect` fills: Godot puts light `index` at column `index % columns`. */
function cellOf(rect: Readonly<DirectionalShadowAtlasRect>, columns: number): number {
  return Math.round(rect.y / rect.height) * columns + Math.round(rect.x / rect.width);
}

/** The grid the shares cut the atlas into, and each cell's split count and depth scales. */
export interface AtlasCells {
  readonly columns: number;
  readonly rows: number;
  /** One per cell: 0 for a cell no light draws. */
  readonly splitCounts: number[];
  /** Four per cell, one for each split, 1 where no split draws. */
  readonly depthScales: number[];
}

/** Every light's rectangle is one cell of one grid (`light_storage.cpp:2577-2597`). */
export function atlasCellsOf(shares: readonly DirectionalShadowAtlasShare[]): AtlasCells {
  const first = shares[0];
  const columns = first ? Math.round(DIRECTIONAL_SHADOW_SIZE_DEFAULT / first.rect.width) : 1;
  const rows = first ? Math.round(DIRECTIONAL_SHADOW_SIZE_DEFAULT / first.rect.height) : 1;
  const splitCounts = new Array<number>(MAX_DIRECTIONAL_LIGHTS).fill(0);
  const depthScales = new Array<number>(MAX_DIRECTIONAL_LIGHTS * DIRECTIONAL_SHADOW_MAX_SPLITS).fill(1);
  for (const share of shares) {
    const cell = cellOf(share.rect, columns);
    splitCounts[cell] = share.splitCount;
    for (let split = 0; split < share.splitCount; split++)
      depthScales[cell * DIRECTIONAL_SHADOW_MAX_SPLITS + split] = share.depthScales[split]!;
  }
  return { columns, rows, splitCounts, depthScales };
}
