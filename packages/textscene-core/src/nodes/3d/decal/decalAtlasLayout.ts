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
import { packCells, type CellSize } from '../../../r3f/textureAtlas/atlasPacking.js';

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
function cellOf({ width, height }: TextureSize): CellSize {
  return {
    width: Math.floor(width / DECAL_ATLAS_BORDER) + 1,
    height: Math.floor(height / DECAL_ATLAS_BORDER) + 1,
  };
}

/**
 * The atlas of `sizes`, in the order Godot's map holds them. With no texture it is one border
 * square, which still holds every mip (`:3144-3153`).
 */
export function packDecalAtlas(sizes: readonly TextureSize[]): DecalAtlasLayout {
  const { width, height, positions } = packCells(
    sizes.map(cellOf),
    DECAL_ATLAS_MIN_COLUMNS,
    DECAL_ATLAS_BORDER
  );
  const rects = positions.map((position, index): PixelRect => ({
    x: position.x * DECAL_ATLAS_BORDER + DECAL_ATLAS_BORDER / 2,
    y: position.y * DECAL_ATLAS_BORDER + DECAL_ATLAS_BORDER / 2,
    width: sizes[index]!.width,
    height: sizes[index]!.height,
  }));
  return { width, height, rects };
}

export interface FittedDecalAtlas {
  layout: DecalAtlasLayout;
  /** Undefined when every texture fit. */
  wanted: TextureSize | undefined;
}

/**
 * Packs `sizes`, and drops the textures that joined last until the atlas fits `maxTextureSize`,
 * since a GPU texture is no larger. Godot has no such limit to meet. `wanted` is the size the whole
 * set needed.
 *
 * A search for the most textures that fit, not a drop of one at a time: a repack for each drop took
 * 410 ms for 100 textures and 16 s for 300, on every rebuild. The search assumes that a shorter
 * prefix never needs a larger atlas. A layout it returns always fits.
 */
export function fitDecalAtlas(sizes: readonly TextureSize[], maxTextureSize: number): FittedDecalAtlas {
  const full = packDecalAtlas(sizes);
  if (isWithin(full, maxTextureSize)) return { layout: full, wanted: undefined };
  const wanted = { width: full.width, height: full.height };
  let fitting = packDecalAtlas([]);
  let low = 0;
  let high = sizes.length - 1;
  while (low < high) {
    const kept = Math.ceil((low + high) / 2);
    const layout = packDecalAtlas(sizes.slice(0, kept));
    if (isWithin(layout, maxTextureSize)) {
      fitting = layout;
      low = kept;
    } else {
      high = kept - 1;
    }
  }
  return { layout: fitting, wanted };
}

function isWithin({ width, height }: TextureSize, maxTextureSize: number): boolean {
  return width <= maxTextureSize && height <= maxTextureSize;
}
