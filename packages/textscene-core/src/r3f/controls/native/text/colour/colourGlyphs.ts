/**
 * The colour form of a glyph, as a face with FreeType's colour flag loads it with `FT_LOAD_COLOR`
 * (`text_server_adv.cpp:1286-1290`): the `COLR` layers that `FT_Render_Glyph` blends
 * (`ftobjs.c:4743-4810`). A glyph with no colour form draws its outline, as before.
 */
import { glyphBitmapGrid, rasteriseGlyph, type BitmapGrid } from '../ftGrays';
import { variedGlyphContoursReader } from '../canvasVariation';
import { opentypeKey, type OpentypeCoordinates } from '../fontMetrics';
import type { GlyphContours } from '../glyphContours';
import type { GlyphBitmap } from '../glyphCoverage';
import type { SfntOutlines } from '../sfntOutlines';
import { perObject } from '../../../../../utils/perObject';
import { recentlyRead } from '../../../../../utils/recentlyRead';
import { blendColrLayers, type ColourBitmap } from './colourBitmap';

/** Whether `outlines` hold a glyph with a colour form, so a run of them may need colour in its raster. */
export function drawsColourGlyphs(outlines: SfntOutlines | null | undefined): boolean {
  return outlines?.colourLayers !== undefined;
}

/**
 * The colour bitmap of a glyph at the glyph origin, null for a colour glyph that covers no pixel,
 * and undefined for a glyph with no colour form.
 */
export type ColourGlyphReader = (glyph: number) => ColourBitmap | null | undefined;

/** A font size animation passes through many sizes, so the colour glyphs of this many sizes of one face are kept. */
const MAX_KEPT_SIZES = 8;

/** The colour glyphs drawn so far, by font, then by size and axis values, then by glyph. */
const drawnColourGlyphs = perObject((_outlines: SfntOutlines) =>
  recentlyRead<string, Map<number, ColourBitmap | null | undefined>>(MAX_KEPT_SIZES)
);

const newColourGlyphsByGlyph = (): Map<number, ColourBitmap | null | undefined> => new Map();

/**
 * The reader of each glyph's colour form at `fontSizePx` and the axis values of `opentype`, or
 * null for outlines with no colour glyph.
 */
export function colourGlyphReader(
  outlines: SfntOutlines,
  fontSizePx: number,
  opentype: OpentypeCoordinates | undefined
): ColourGlyphReader | null {
  const { colourLayers } = outlines;
  if (!colourLayers) return null;
  const drawn = drawnColourGlyphs(outlines)(`${fontSizePx}/${opentypeKey(opentype)}`, newColourGlyphsByGlyph);
  // FreeType loads each layer with the base glyph's flags, and renders it at once, so Godot's
  // subpixel shift, embolden and shear never reach it.
  const variation = { embolden: 0, skew: 0, opentype };
  const variedContours = variedGlyphContoursReader(outlines, fontSizePx, variation);
  // The varied reader reads no `.notdef`, which a layer may name.
  const layerContours = (layerGlyph: number) =>
    layerGlyph === 0 ? outlines.glyphContours(0, fontSizePx, variation) : variedContours(layerGlyph);
  return (glyph) => {
    if (drawn.has(glyph)) return drawn.get(glyph);
    const layers = colourLayers(glyph);
    const bitmap =
      layers &&
      blendColrLayers(
        layers.map(({ glyph: layerGlyph, colour }) => ({
          coverage: layerCoverage(layerContours(layerGlyph)),
          colour,
        }))
      );
    const colourForm = layers ? bitmap : undefined;
    drawn.set(glyph, colourForm);
    return colourForm;
  };
}

/** The bitmap FreeType presets for an outline with no point: no pixel, at the glyph origin. */
const NO_PIXEL: GlyphBitmap = { grid: { left: 0, top: 0, width: 0, height: 0 }, coverage: new Uint8Array(0) };

/** The coverage of a layer outline at the glyph origin, unmoved. */
function layerCoverage(contours: GlyphContours | null): GlyphBitmap {
  const grid: BitmapGrid | null = contours && glyphBitmapGrid(contours);
  if (!contours || !grid) return NO_PIXEL;
  const hasPixels = grid.width > 0 && grid.height > 0;
  return { grid, coverage: hasPixels ? rasteriseGlyph(contours, grid) : new Uint8Array(0) };
}
