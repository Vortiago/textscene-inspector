/**
 * Godot 4.7.2's area light atlas: every `area_texture` in one RGBA8 texture, each with a border and
 * a chain of blurred mips, and where each light samples it (`texture_storage.cpp:3345-3510`,
 * `light_storage.cpp:1132-1141`). The shader picks a mip by the fragment's distance to the light.
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

import { nextPowerOfTwo } from '../../godot/math/powerOfTwo.js';
import { fractionOfAtlas } from '../textureAtlas/atlasFraction.js';
import type { AtlasRect } from '../../resources/textures/atlastexture/types.js';
import { packCells, type CellSize } from '../textureAtlas/atlasPacking.js';
import type { GodotImage } from '../textureAtlas/godotImage.js';
import type { ImageSize } from '../../resources/formats/image/imagePixels.js';
import type { MipLevel } from '../../resources/processing/mipChain.js';
import type { AtlasLayout } from '../textureAtlas/fitAtlas.js';
import { areaTextureMipmaps } from './atlasMipmaps.js';
import { AREA_LIGHT_ATLAS_MIPMAPS } from '../../godot/rendering/lights/areaLightAtlas.js';

/** Where a light finds its texture in the atlas. */
export interface AreaTexturePlacement {
  /** As fractions of the atlas. */
  rect: Readonly<AtlasRect>;
  /** The highest mip the shader reads (`cone_angle` in the light buffer). */
  maxMipmap: number;
}

/** Each texture takes whole cells of this side, plus one cell of border (`texture_storage.cpp:3361`). */
const BORDER = 1 << (AREA_LIGHT_ATLAS_MIPMAPS - 1);

/** A texture's cells, border cell included. */
interface Cell extends CellSize {
  /** The texels the texture fills, which `copy_to_atlas_fb` stretches it to. */
  pixelWidth: number;
  pixelHeight: number;
}

/** A texture's cells, and the texels it fills: whole cells, or a power of two below one cell (`:3373-3383`). */
function cellOf(image: ImageSize): Cell {
  const cellsX = Math.ceil(image.width / BORDER);
  const cellsY = Math.ceil(image.height / BORDER);
  return {
    width: cellsX + 1,
    height: cellsY + 1,
    pixelWidth: image.width < BORDER ? nextPowerOfTwo(image.width) : cellsX * BORDER,
    pixelHeight: image.height < BORDER ? nextPowerOfTwo(image.height) : cellsY * BORDER,
  };
}

/** Godot's `cone_angle` for an area light: the mips the texture's shorter side holds, up to the atlas's. */
function maxMipmapOf(texture: AtlasRect): number {
  const shorter = Math.max(Math.min(texture.width, texture.height), 1);
  return Math.min(Math.floor(Math.log2(shorter)), AREA_LIGHT_ATLAS_MIPMAPS) - 1;
}

// texture_storage.cpp:3345-3468
export function buildAreaLightAtlas(sizes: readonly ImageSize[], limit = Infinity): AtlasLayout {
  const cells = sizes.map(cellOf);
  const { width, height, positions, wanted } = packCells(cells, 1, BORDER, limit);
  const rects = positions.map((position, index) => ({
    x: position.x * BORDER,
    y: position.y * BORDER,
    width: cells[index]!.pixelWidth,
    height: cells[index]!.pixelHeight,
  }));
  return { width, height, rects, wanted };
}

export function areaPlacement(rect: AtlasRect, layout: AtlasLayout): AreaTexturePlacement {
  return { rect: fractionOfAtlas(rect, layout), maxMipmap: maxMipmapOf(rect) };
}

export function areaAtlasLevels(
  { width, height, rects }: AtlasLayout,
  images: readonly GodotImage[]
): MipLevel[] {
  const placed = rects.map((rect, index) => ({ ...rect, image: images[index]! }));
  return areaTextureMipmaps(width, height, placed);
}
