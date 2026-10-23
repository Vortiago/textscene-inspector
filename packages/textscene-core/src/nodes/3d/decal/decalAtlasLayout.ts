/**
 * Where Godot's decal atlas puts each texture, as a pure function of the texture sizes
 * (`TextureStorage::update_decal_atlas`, `texture_storage.cpp:3038-3153`).
 */

/*
 * The layout is derived from Godot Engine
 * (`servers/rendering/renderer_rd/storage_rd/texture_storage.cpp`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

import { DECAL_ATLAS_BORDER, DECAL_ATLAS_MIN_COLUMNS } from '../../../godot/rendering/decalAtlas.js';
import { nextPowerOfTwo } from '../../../godot/math/powerOfTwo.js';
import { packCells, type PackedCell } from '../../../r3f/textureAtlas/atlasPacking.js';

export interface TextureSize {
  width: number;
  height: number;
}

/** A texture's texels in the atlas. */
export interface PixelRect extends TextureSize {
  x: number;
  y: number;
}

export interface DecalAtlasLayout extends TextureSize {
  /** One for each texture, in the order given. */
  rects: readonly PixelRect[];
}

/** A texture's cells: `(size / 32) + 1`, the integer division of `:3059-3060`. */
function cellOf({ width, height }: TextureSize): PackedCell {
  return {
    width: Math.floor(width / DECAL_ATLAS_BORDER) + 1,
    height: Math.floor(height / DECAL_ATLAS_BORDER) + 1,
    x: 0,
    y: 0,
  };
}

/**
 * The atlas of `sizes`, in the order Godot's map holds them. With no texture it is one border
 * square, which still holds every mip (`:3144-3153`).
 */
export function packDecalAtlas(sizes: readonly TextureSize[]): DecalAtlasLayout {
  if (sizes.length === 0) return { width: DECAL_ATLAS_BORDER, height: DECAL_ATLAS_BORDER, rects: [] };
  const cells = sizes.map(cellOf);
  const { columns, rows } = packCells(cells, DECAL_ATLAS_MIN_COLUMNS);
  const rects = cells.map((cell, index): PixelRect => ({
    x: cell.x * DECAL_ATLAS_BORDER + DECAL_ATLAS_BORDER / 2,
    y: cell.y * DECAL_ATLAS_BORDER + DECAL_ATLAS_BORDER / 2,
    width: sizes[index]!.width,
    height: sizes[index]!.height,
  }));
  return {
    width: columns * DECAL_ATLAS_BORDER,
    height: nextPowerOfTwo(rows * DECAL_ATLAS_BORDER),
    rects,
  };
}

/** The atlas of the earliest textures of `sizes` that fit `maxTextureSize`, and the size the whole set wanted when it did not. */
export interface FittedDecalAtlas {
  layout: DecalAtlasLayout;
  /** Undefined when every texture fit. */
  wanted: TextureSize | undefined;
}

/**
 * Packs `sizes`, and drops the textures that joined last until the atlas fits `maxTextureSize`,
 * since a GPU texture is no larger. Godot has no such limit to meet.
 */
export function fitDecalAtlas(sizes: readonly TextureSize[], maxTextureSize: number): FittedDecalAtlas {
  const full = packDecalAtlas(sizes);
  if (isWithin(full, maxTextureSize)) return { layout: full, wanted: undefined };
  const wanted = { width: full.width, height: full.height };
  for (let kept = sizes.length - 1; kept > 0; kept--) {
    const layout = packDecalAtlas(sizes.slice(0, kept));
    if (isWithin(layout, maxTextureSize)) return { layout, wanted };
  }
  return { layout: packDecalAtlas([]), wanted };
}

function isWithin({ width, height }: TextureSize, maxTextureSize: number): boolean {
  return width <= maxTextureSize && height <= maxTextureSize;
}
