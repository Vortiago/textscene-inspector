/**
 * The bundled Open Sans SemiBold as a `'canvas'`-kind `FontMetrics`, for the canvas-2D painter.
 * Godot's default project font is not MSDF and rasterises through FreeType
 * (`servers/text/text_server.cpp:2386`, read by `scene/theme/theme_db.cpp:59`).
 * The bundled arm of `sceneFontLoader.ts` is the only production caller.
 */

// Only the rasteriser changes: every number reads through `OPEN_SANS_FONT_METRICS`, never
// `createRuntimeFontMetrics`. Its `measureText` floats enter the fixed-point chain
// (`ftadvanc.c:52`, `hb-ft.cc:519,523`) up to a 1/64 px step off the integer `hmtx` value.
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';

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
    getGlyphAdvanceUnits: (ch) => OPEN_SANS_FONT_METRICS.getGlyphAdvanceUnits(ch),
    getKerningAdjustmentUnits: (a, b) => OPEN_SANS_FONT_METRICS.getKerningAdjustmentUnits(a, b),
    get averageAdvanceUnits() {
      return OPEN_SANS_FONT_METRICS.averageAdvanceUnits;
    },
  };
}
