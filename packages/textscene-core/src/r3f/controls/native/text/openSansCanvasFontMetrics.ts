/**
 * The bundled Open Sans SemiBold as a `'canvas'`-kind `FontMetrics`, for the canvas painter.
 * Godot's default project font is not MSDF and rasterises through FreeType
 * (`servers/text/text_server.cpp:2386`, read by `scene/theme/theme_db.cpp:59`).
 */

// Only the rasteriser changes: every number reads through `OPEN_SANS_FONT_METRICS`, never
// `createRuntimeFontMetrics`. Its `measureText` floats enter the fixed-point chain
// (`ftadvanc.c:52`, `hb-ft.cc:519,523`) up to a 1/64 px step off the integer `hmtx` value.
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { OutlineCanvasFontMetrics } from './runtimeFontMetrics';

/**
 * The bundled font's baked metrics as `'canvas'`-kind. It names no CSS family: Godot loads its
 * default font from embedded bytes as a font file (`scene/theme/default_theme.cpp:1378-1388`), so
 * every glyph draws from the outlines `bundledCanvasFace.ts` adds. Getters, not a snapshot, so a
 * live mutation of `OPEN_SANS_METRICS` stays visible.
 */
export const OPEN_SANS_CANVAS_FONT_METRICS: OutlineCanvasFontMetrics = {
  kind: 'canvas',
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
