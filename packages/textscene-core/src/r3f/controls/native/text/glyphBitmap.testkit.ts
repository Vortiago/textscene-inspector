/**
 * Godot's glyph bitmaps as the value tests hold them (`hintingTarget.godot.json`,
 * `ftStroker.godot.json`), and the view of our own bitmap that compares with one.
 */
import { rasteriseGlyph, type BitmapGrid } from './ftGrays';
import type { GlyphContours } from './glyphContours';

/** One glyph bitmap Godot 4.6.3 draws, read from its glyph texture. */
export interface GodotGlyphBitmap {
  font: string;
  char: string;
  sizePx: number;
  /** `font_get_glyph_offset`: the bitmap's top-left corner in px from the glyph origin, y down. */
  offset: [number, number];
  /** The 8-bit alpha of each pixel, row by row. */
  coverage: number[][];
}

/**
 * Godot's glyph texture holds a margin of one pixel round the FreeType bitmap (`rasterize_bitmap`,
 * `text_server_adv.cpp:1223-1224`), which the reference bitmaps keep.
 */
const GODOT_GLYPH_MARGIN = 1;

/** The grid of a Godot glyph bitmap, its margin included. */
export const godotGrid = (bitmap: GodotGlyphBitmap): BitmapGrid => ({
  left: bitmap.offset[0],
  top: bitmap.offset[1],
  width: bitmap.coverage[0]!.length,
  height: bitmap.coverage.length,
});

/** The grid of the FreeType bitmap inside a Godot glyph bitmap: its margin taken off. */
export function freeTypeGrid(bitmap: GodotGlyphBitmap): BitmapGrid {
  const { left, top, width, height } = godotGrid(bitmap);
  return {
    left: left + GODOT_GLYPH_MARGIN,
    top: top + GODOT_GLYPH_MARGIN,
    width: width - 2 * GODOT_GLYPH_MARGIN,
    height: height - 2 * GODOT_GLYPH_MARGIN,
  };
}

/** Our coverage of `contours` on the grid of `bitmap`, row by row as Godot's. */
export function coverageRows(contours: GlyphContours, bitmap: GodotGlyphBitmap): number[][] {
  const grid = godotGrid(bitmap);
  const coverage = rasteriseGlyph(contours, grid);
  return Array.from({ length: grid.height }, (_, row) =>
    Array.from(coverage.subarray(row * grid.width, (row + 1) * grid.width))
  );
}
