/**
 * The colour bitmap of a glyph as Godot's RGBA8 glyph texture holds it: FreeType's premultiplied
 * BGRA, copied into RGBA unchanged (`text_server_adv.cpp:1171-1177`). This module builds one from
 * the coverage of each `COLR` layer, as `tt_face_colr_blend_layer` blends it (`ttcolr.c:1735-1900`).
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import type { BitmapGrid } from '../ftGrays';
import type { GlyphBitmap } from '../glyphCoverage';
import type { BgraColour } from './cpal';

/** A colour bitmap and the grid it covers, in px from the glyph origin, y down. */
export interface ColourBitmap {
  readonly grid: BitmapGrid;
  /** Red, green, blue and alpha of each pixel, row by row from the top, the colour premultiplied by alpha. */
  readonly texels: Uint8Array;
}

/** The coverage of one layer glyph and the colour it paints. */
export interface PaintedLayer {
  /** The layer's bitmap. An empty outline covers no pixel at the glyph origin, as FreeType presets it. */
  readonly coverage: GlyphBitmap;
  readonly colour: BgraColour;
}

/**
 * The colour bitmap of `layers` blended in order, each over those before it. The first layer that
 * covers a pixel sets the grid, and each later one widens it to cover both. Nothing, for layers
 * that cover no pixel, as such a glyph draws no quad.
 */
export function blendColrLayers(layers: readonly PaintedLayer[]): ColourBitmap | null {
  let bitmap: ColourBitmap | null = null;
  for (const { coverage, colour } of layers) {
    bitmap = bitmap ? widened(bitmap, coverage.grid) : emptyBitmap(coverage.grid);
    if (bitmap) blendLayer(bitmap, coverage, colour);
  }
  return bitmap;
}

/** A bitmap of `grid` with every texel 0, or null for a grid with no pixel, as FreeType allocates none. */
function emptyBitmap(grid: BitmapGrid): ColourBitmap | null {
  if (grid.width === 0 || grid.height === 0) return null;
  return { grid: { ...grid }, texels: new Uint8Array(grid.width * grid.height * 4) };
}

/** `bitmap` on the grid that covers both its own and `grid`, its texels moved to their place. */
function widened(bitmap: ColourBitmap, grid: BitmapGrid): ColourBitmap {
  const own = bitmap.grid;
  const left = Math.min(own.left, grid.left);
  const top = Math.min(own.top, grid.top);
  const right = Math.max(own.left + own.width, grid.left + grid.width);
  const bottom = Math.max(own.top + own.height, grid.top + grid.height);
  if (
    left === own.left &&
    top === own.top &&
    right === own.left + own.width &&
    bottom === own.top + own.height
  )
    return bitmap;
  const wide: ColourBitmap = {
    grid: { left, top, width: right - left, height: bottom - top },
    texels: new Uint8Array((right - left) * (bottom - top) * 4),
  };
  for (let row = 0; row < own.height; row++) {
    const from = row * own.width * 4;
    const to = ((own.top - top + row) * wide.grid.width + own.left - left) * 4;
    wide.texels.set(bitmap.texels.subarray(from, from + own.width * 4), to);
  }
  return wide;
}

/** Lays `coverage` in `colour` over `bitmap`, in FreeType's integer arithmetic, which truncates each step. */
function blendLayer(bitmap: ColourBitmap, { grid, coverage }: GlyphBitmap, colour: BgraColour): void {
  const [blue, green, red, alpha] = colour;
  const { texels } = bitmap;
  for (let row = 0; row < grid.height; row++) {
    const rowAt = ((grid.top - bitmap.grid.top + row) * bitmap.grid.width + grid.left - bitmap.grid.left) * 4;
    for (let column = 0; column < grid.width; column++) {
      const layerAlpha = trunc(alpha * coverage[row * grid.width + column]!);
      const kept = 255 - layerAlpha;
      const at = rowAt + column * 4;
      texels[at] = trunc(texels[at]! * kept) + trunc(red * layerAlpha);
      texels[at + 1] = trunc(texels[at + 1]! * kept) + trunc(green * layerAlpha);
      texels[at + 2] = trunc(texels[at + 2]! * kept) + trunc(blue * layerAlpha);
      texels[at + 3] = trunc(texels[at + 3]! * kept) + layerAlpha;
    }
  }
}

/** A product of two 0-255 levels, divided by 255 and truncated, as C's integer division does. */
function trunc(product: number): number {
  return Math.floor(product / 255);
}
