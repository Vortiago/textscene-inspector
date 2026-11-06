/**
 * The bundled Open Sans SemiBold as a `'canvas'`-kind `FontMetrics`, for the canvas-2D painter.
 * Godot's default project font is not MSDF and rasterises through FreeType
 * (`servers/text/text_server.cpp:2386`, read by `scene/theme/theme_db.cpp:59`).
 * `bundledFontLoader.ts` is the only production caller.
 */

// Only the rasteriser changes: every number reads through `OPEN_SANS_FONT_METRICS`, never
// `createRuntimeFontMetrics`. Its `measureText` floats enter the fixed-point chain
// (`ftadvanc.c:52`, `hb-ft.cc:519,523`) up to a 1/64 px step off the integer `hmtx` value.
import { OPEN_SANS_ATLAS_GLYPHS, OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { CanvasFontMetrics, GlyphInk } from './runtimeFontMetrics';

const UNITS_PER_ATLAS_PX = OPEN_SANS_FONT_METRICS.unitsPerEm / OPEN_SANS_ATLAS_INFO.fontSize;

/** Written only by `atlasGlyphInkUnits`, one entry per character a raster asks for. */
const atlasGlyphInk = new Map<string, GlyphInk>();

/**
 * The ink box of `ch` from its atlas bitmap, which the distance-field range pads a little. Undefined
 * for a character the atlas lacks.
 */
function atlasGlyphInkUnits(ch: string): GlyphInk | undefined {
  const cached = atlasGlyphInk.get(ch);
  if (cached) return cached;
  const glyph = OPEN_SANS_ATLAS_GLYPHS[ch];
  if (!glyph) return undefined;
  const ink = {
    left: -glyph.xoffset * UNITS_PER_ATLAS_PX,
    right: (glyph.xoffset + glyph.width) * UNITS_PER_ATLAS_PX,
  };
  atlasGlyphInk.set(ch, ink);
  return ink;
}

/**
 * Wraps the bundled font's baked metrics as `'canvas'`-kind, tagged with the CSS family it was
 * registered under. An unregistered `cssFontFamily` makes `ctx.fillText` paint a system font.
 * Getters, not a snapshot, so a live mutation of `OPEN_SANS_METRICS` stays visible.
 */
export function createOpenSansCanvasFontMetrics(cssFontFamily: string): CanvasFontMetrics {
  return {
    kind: 'canvas',
    cssFontFamily,
    get unitsPerEm() {
      return OPEN_SANS_FONT_METRICS.unitsPerEm;
    },
    get ascent() {
      return OPEN_SANS_FONT_METRICS.ascent;
    },
    get descent() {
      return OPEN_SANS_FONT_METRICS.descent;
    },
    hasGlyph: (ch) => OPEN_SANS_FONT_METRICS.hasGlyph(ch),
    getGlyphAdvanceUnits: (ch) => OPEN_SANS_FONT_METRICS.getGlyphAdvanceUnits(ch),
    getGlyphInkUnits: atlasGlyphInkUnits,
    getKerningAdjustmentUnits: (a, b) => OPEN_SANS_FONT_METRICS.getKerningAdjustmentUnits(a, b),
    get averageAdvanceUnits() {
      return OPEN_SANS_FONT_METRICS.averageAdvanceUnits;
    },
    get shaping() {
      return OPEN_SANS_FONT_METRICS.shaping;
    },
    get markOffsets() {
      return OPEN_SANS_FONT_METRICS.markOffsets;
    },
  };
}
