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
import { packCells, type PackedCell } from '../textureAtlas/atlasPacking.js';
import type { GodotImage } from '../textureAtlas/godotImage.js';
import { areaTextureMipmaps, type PlacedTexture } from './atlasMipmaps.js';
import { AREA_LIGHT_ATLAS_MIPMAPS } from '../../godot/rendering/lights/areaLightAtlas.js';

/** Where a light finds its texture in the atlas. */
export interface AreaTexturePlacement {
  /** Left, top, width and height, as fractions of the atlas. */
  rect: readonly [number, number, number, number];
  /** The highest mip the shader reads (`cone_angle` in the light buffer). */
  maxMipmap: number;
}

/** The atlas's linear RGBA8 mips, largest first, each first row the top row. */
export interface AreaLightAtlas {
  width: number;
  height: number;
  mipmaps: Uint8Array[];
  /** One for each image, in the order given. */
  placements: AreaTexturePlacement[];
}

/** Each texture takes whole cells of this side, plus one cell of border (`texture_storage.cpp:3361`). */
const BORDER = 1 << (AREA_LIGHT_ATLAS_MIPMAPS - 1);

/** A texture's cells, border cell included. */
interface Cell extends PackedCell {
  /** The texels the texture fills, which `copy_to_atlas_fb` stretches it to. */
  pixelWidth: number;
  pixelHeight: number;
}

/** A texture's cells, and the texels it fills: whole cells, or a power of two below one cell (`:3373-3383`). */
function cellOf(image: GodotImage): Cell {
  const cellsX = Math.ceil(image.width / BORDER);
  const cellsY = Math.ceil(image.height / BORDER);
  return {
    width: cellsX + 1,
    height: cellsY + 1,
    pixelWidth: image.width < BORDER ? nextPowerOfTwo(image.width) : cellsX * BORDER,
    pixelHeight: image.height < BORDER ? nextPowerOfTwo(image.height) : cellsY * BORDER,
    x: 0,
    y: 0,
  };
}

/** Godot's `cone_angle` for an area light: the mips the texture's shorter side holds, up to the atlas's. */
function maxMipmapOf(texture: PlacedTexture): number {
  const shorter = Math.max(Math.min(texture.width, texture.height), 1);
  return Math.min(Math.floor(Math.log2(shorter)), AREA_LIGHT_ATLAS_MIPMAPS) - 1;
}

/**
 * The atlas of `images`, in the order Godot adds them. With no image, the atlas is one blank cell
 * that still holds every mip (`:3460-3463`).
 */
export function buildAreaLightAtlas(images: readonly GodotImage[]): AreaLightAtlas {
  const cells = images.map(cellOf);
  const { columns, rows } = cells.length > 0 ? packCells(cells, 1) : { columns: 1, rows: 1 };
  const width = columns * BORDER;
  const height = cells.length > 0 ? nextPowerOfTwo(rows * BORDER) : BORDER;
  const placed = cells.map((cell, index): PlacedTexture => ({
    image: images[index]!,
    x: cell.x * BORDER,
    y: cell.y * BORDER,
    width: cell.pixelWidth,
    height: cell.pixelHeight,
  }));
  const placements = placed.map((texture): AreaTexturePlacement => ({
    rect: [texture.x / width, texture.y / height, texture.width / width, texture.height / height],
    maxMipmap: maxMipmapOf(texture),
  }));
  const mipmaps = areaTextureMipmaps(width, height, placed);
  return { width, height, mipmaps, placements };
}
