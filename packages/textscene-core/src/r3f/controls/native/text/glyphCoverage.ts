/**
 * A glyph drawn as Godot draws it: FreeType's coverage bitmap of the outline, or of its stroked ring,
 * laid on a raster at the glyph's place. A canvas fill or stroke of the same outline misses
 * FreeType's coverage by up to 27 levels, which this matches to the level.
 */
import { glyphBitmapGrid, rasteriseGlyph, type BitmapGrid } from './ftGrays';
import { strokeGlyphContours } from './ftStroker';
import type { GlyphContours } from './glyphContours';
import { perObject } from '../../../../utils/perObject';

/** A coverage bitmap and the grid it covers, in px from the glyph origin or, once placed, in raster px. */
export interface GlyphBitmap {
  grid: BitmapGrid;
  coverage: Uint8Array;
}

/** 26.6 fixed point: FreeType moves an outline (`FT_Outline_Translate`) in 1/64 px. */
const OUTLINE_UNITS_PER_PX = 64;

/** The bitmaps drawn so far of each glyph outline, by subpixel shift and outline radius. */
const drawnBitmaps = perObject((_contours: GlyphContours) => new Map<string, GlyphBitmap | null>());

/** `contours` moved by `(dx, dy)` px. */
function movedContours(contours: GlyphContours, dx: number, dy: number): GlyphContours {
  if (dx === 0 && dy === 0) return contours;
  return {
    ...contours,
    points: contours.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
  };
}

/**
 * The bitmap of `contours` moved by a subpixel shift of `(dx, dy)` px, filled or stroked at
 * `outlineRadiusPx`. Godot moves the outline before it strokes it (`text_server_adv.cpp:1303-1310`),
 * which is not the same as a stroke moved after: the stroker truncates each midpoint toward zero.
 */
function drawGlyphBitmap(
  contours: GlyphContours,
  dx: number,
  dy: number,
  outlineRadiusPx: number
): GlyphBitmap | null {
  const moved = movedContours(contours, dx, dy);
  const drawn = outlineRadiusPx > 0 ? strokeGlyphContours(moved, outlineRadiusPx) : moved;
  const grid = glyphBitmapGrid(drawn);
  if (!grid || grid.width === 0 || grid.height === 0) return null;
  return { grid, coverage: rasteriseGlyph(drawn, grid) };
}

/**
 * The bitmap of the glyph `contours` at the glyph origin `(originX, originY)` on a raster, filled,
 * or stroked for an `outlineRadiusPx` above 0. The bitmap lands on whole raster pixels, and the
 * outline takes the origin's fraction in 1/64 px. Nothing, for a glyph that draws no pixel.
 */
export function placedGlyphBitmap(
  contours: GlyphContours,
  originX: number,
  originY: number,
  outlineRadiusPx: number
): GlyphBitmap | null {
  const wholeX = Math.floor(originX);
  const wholeY = Math.floor(originY);
  const dx = Math.round((originX - wholeX) * OUTLINE_UNITS_PER_PX) / OUTLINE_UNITS_PER_PX;
  const dy = Math.round((originY - wholeY) * OUTLINE_UNITS_PER_PX) / OUTLINE_UNITS_PER_PX;
  const bitmaps = drawnBitmaps(contours);
  const key = `${dx},${dy},${outlineRadiusPx}`;
  let bitmap = bitmaps.get(key);
  if (bitmap === undefined) bitmaps.set(key, (bitmap = drawGlyphBitmap(contours, dx, dy, outlineRadiusPx)));
  if (!bitmap) return null;
  const { grid, coverage } = bitmap;
  return { grid: { ...grid, left: grid.left + wholeX, top: grid.top + wholeY }, coverage };
}

/** An opaque sRGB colour, each channel 0-255. */
export type ByteColour = readonly [red: number, green: number, blue: number];

/**
 * Lays `bitmap` over `image` in `colour`, as Godot blends each glyph quad over what
 * is under it: the alphas combine as `a + c (1 - a)`. A pixel off the image is dropped.
 */
export function blendGlyphBitmap(
  image: ImageData,
  { grid, coverage }: GlyphBitmap,
  colour: ByteColour
): void {
  const { data, width, height } = image;
  for (let row = 0; row < grid.height; row++) {
    const y = grid.top + row;
    if (y < 0 || y >= height) continue;
    for (let column = 0; column < grid.width; column++) {
      const x = grid.left + column;
      const level = coverage[row * grid.width + column]!;
      if (x < 0 || x >= width || level === 0) continue;
      const at = (y * width + x) * 4;
      data.set(colour, at);
      data[at + 3] = Math.round(level + (data[at + 3]! * (255 - level)) / 255);
    }
  }
}
