/**
 * The bundled Open Sans SemiBold as a `'canvas'`-kind `FontMetrics`
 * (`./fontMetrics.ts`) — the same font `openSansFontMetrics.ts` exposes as
 * `'atlas'`, re-pointed at the canvas-2D painter (`canvasTextPainter.ts`),
 * since Godot's default project font is NOT MSDF and rasterises through
 * FreeType (`servers/text/text_server.cpp:2386`, read by
 * `scene/theme/theme_db.cpp:59`).
 *
 * Only the RASTERISER changes; the numbers do not. Every advance, kerning
 * pair and scalar reads through `OPEN_SANS_FONT_METRICS` to the generated
 * `openSansMetrics.ts` — never `runtimeFontMetrics.ts`'s
 * `createRuntimeFontMetrics`, whose advances are canvas `measureText`
 * floats. The baked table is the font's own INTEGER `hmtx` value, and
 * `getFontGlyphAdvancePx` puts it through FreeType's/HarfBuzz's fixed-point
 * chain (`ftadvanc.c:52`, `hb-ft.cc:519,523`); a measured float entering
 * that chain lands up to a 1/64 px step off, drifting this font's shaping
 * from every other consumer of it and from Godot.
 *
 * Getters, not a snapshot, for the reason `openSansFontMetrics.ts` uses
 * them: a live mutation of `OPEN_SANS_METRICS` stays visible.
 *
 * `bundledFontRegistration.ts` is the only intended production caller — an
 * unregistered `cssFontFamily` makes `ctx.fillText` paint a SYSTEM font.
 */
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';

/** Wraps the bundled font's baked metrics as `'canvas'`-kind, tagged with the CSS family it was registered under. */
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
