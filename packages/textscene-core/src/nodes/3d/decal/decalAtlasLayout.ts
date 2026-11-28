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
import type { ImageSize } from '../../../resources/formats/image/imagePixels.js';
import type { AtlasRect } from '../../../resources/textures/atlastexture/types.js';
import type { AtlasLayout } from '../../../r3f/textureAtlas/fitAtlas.js';

/** A texture's cells: `(size / 32) + 1`, the integer division of `:3059-3060`. */
function cellOf({ width, height }: ImageSize): CellSize {
  return {
    width: Math.floor(width / DECAL_ATLAS_BORDER) + 1,
    height: Math.floor(height / DECAL_ATLAS_BORDER) + 1,
  };
}

/**
 * The atlas of `sizes`, in the order Godot's map holds them. With no texture it is one border
 * square, which still holds every mip (`:3144-3153`).
 */
export function packDecalAtlas(sizes: readonly ImageSize[], limit = Infinity): AtlasLayout {
  const { width, height, positions, wanted } = packCells(
    sizes.map(cellOf),
    DECAL_ATLAS_MIN_COLUMNS,
    DECAL_ATLAS_BORDER,
    limit
  );
  const rects = positions.map((position, index): AtlasRect => ({
    x: position.x * DECAL_ATLAS_BORDER + DECAL_ATLAS_BORDER / 2,
    y: position.y * DECAL_ATLAS_BORDER + DECAL_ATLAS_BORDER / 2,
    width: sizes[index]!.width,
    height: sizes[index]!.height,
  }));
  return { width, height, rects, wanted };
}
