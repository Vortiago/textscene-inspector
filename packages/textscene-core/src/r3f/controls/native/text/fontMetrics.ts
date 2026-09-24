/**
 * The font-metrics contract the native Control text engine shapes against, plus
 * the shared px quantisation every implementation goes through. An implementation
 * supplies only design-unit data. This module imports nothing, so a consumer of
 * the type never pulls Open Sans's baked data into its closure.
 */

/**
 * Which glyph-painting path a `FontMetrics` pairs with, since shaping is
 * font-agnostic but rasterisation is not. `'atlas'` is a baked MSDF atlas
 * (`openSansFontMetrics.ts`), the only kind `GlyphPlacement.glyph` looks up.
 * `'canvas'` is a runtime-loaded scene font (`runtimeFontMetrics.ts`) drawn through canvas-2D.
 */
export type FontMetricsKind = 'atlas' | 'canvas';

/**
 * Raw, design-unit font metrics a shaper needs. The functions below scale them
 * through `unitsPerEm` and `fontSizePx`. An implementation never scales them itself.
 */
export interface FontMetrics {
  /** Which glyph-painting path this metrics object pairs with. */
  readonly kind: FontMetricsKind;
  /** Design units per em (`hhea`/`head` table `unitsPerEm`): the scale denominator for every raw unit below. */
  readonly unitsPerEm: number;
  /** `hhea` ascender, design units (positive, upward), before `getFontAscentPx` rounds it. */
  readonly ascent: number;
  /** `hhea` descender magnitude, design units (positive), before `getFontLinePitchPx` rounds it. */
  readonly descent: number;
  /** A character's own advance width, design units, or `null` if this font has no glyph for it (a shaper falls back to `averageAdvanceUnits`). */
  getGlyphAdvanceUnits(ch: string): number | null;
  /** Pairwise advance adjustment for two adjacent characters, design units, or `0` when the font has no entry for the pair. */
  getKerningAdjustmentUnits(a: string, b: string): number;
  /** This font's typical glyph width (such as OS/2 `xAvgCharWidth`), design units: the fallback advance for a character outside its charset. */
  readonly averageAdvanceUnits: number;
}

/**
 * `units` scaled to `fontSizePx` as `units * (fontSizePx / unitsPerEm)`. `units * fontSizePx / unitsPerEm` is
 * bit-identical only at a power-of-two `unitsPerEm`. No rule stops at this float: ascent and descent ceil to whole
 * pixels, and an advance goes through FreeType's and HarfBuzz's fixed-point chain to whole 1/64 px. The whole-pixel
 * advance round above the subpixel threshold carries a remainder between glyphs, so it lives in `textLayout.ts`.
 */
function unitsToPx(units: number, metrics: Pick<FontMetrics, 'unitsPerEm'>, fontSizePx: number): number {
  return units * (fontSizePx / metrics.unitsPerEm);
}

/**
 * Ascent rounded up to a whole pixel, as FreeType's 26.6 size metrics
 * (`face->size->metrics.ascender`) are (`modules/text_server_adv/text_server_adv.cpp:1515-1516`).
 * A line's baseline sits this far below its top (`rich_text_label.cpp:1049`), and
 * every baseline-relative quantity adds to this value rather than re-deriving it.
 */
export function getFontAscentPx(metrics: Pick<FontMetrics, 'ascent' | 'unitsPerEm'>, fontSizePx: number): number {
  return Math.ceil(unitsToPx(metrics.ascent, metrics, fontSizePx));
}

/**
 * Pixel line pitch: ascent and descent each ceil to a whole pixel before the sum
 * (`modules/text_server_adv/text_server_adv.cpp:1515-1516`). A float sum rounded once
 * undershoots by about 1px, as measured against Godot. At Open Sans SemiBold 16 with
 * Label's spacing: ceil(2189*16/2048) + ceil(600*16/2048) + 3 = 18 + 5 + 3 = 26.
 */
// `lineSpacingPx` has no default: `Math::round(3 * scale)` is Label's constant
// (`scene/theme/default_theme.cpp:392`), and other controls read another key or none.
export function getFontLinePitchPx(
  metrics: Pick<FontMetrics, 'ascent' | 'descent' | 'unitsPerEm'>,
  fontSizePx: number,
  lineSpacingPx: number
): number {
  const ascentPx = getFontAscentPx(metrics, fontSizePx);
  const descentPx = Math.ceil(unitsToPx(metrics.descent, metrics, fontSizePx));
  return ascentPx + descentPx + lineSpacingPx;
}

/** 1.0 in FreeType's 16.16 fixed point (`FT_Fixed`). */
const FIXED_16_16_ONE = 65536;

/**
 * `freetype/include/freetype/fttypes.h`'s `FT_DivFix` (`freetype/src/base/ftcalc.c`):
 * `a / b` in 16.16, rounded half up on the magnitude (`q = ( ( (FT_UInt64)a << 16 ) +
 * ( b >> 1 ) ) / b`), then signed. A division, not a shift: the intermediate exceeds 32 bits.
 */
function ftDivFix(a: number, b: number): number {
  const sign = Math.sign(a) * Math.sign(b);
  const magnitude = Math.floor((Math.abs(a) * FIXED_16_16_ONE + Math.floor(Math.abs(b) / 2)) / Math.abs(b));
  return sign * magnitude;
}

/** `freetype/src/base/ftcalc.c`'s `FT_MulFix`: `a * b / 65536`, rounded half up on the magnitude. */
function ftMulFix(a: number, b: number): number {
  const sign = Math.sign(a) * Math.sign(b);
  const magnitude = Math.floor((Math.abs(a) * Math.abs(b) + FIXED_16_16_ONE / 2) / FIXED_16_16_ONE);
  return sign * magnitude;
}

/**
 * The `FT_Size_Request` Godot issues: `FT_SIZE_REQUEST_TYPE_NOMINAL` at `width =
 * height = sz * 64` with zero resolutions (`text_server_adv.cpp:1500-1507`, `sz` at
 * `:1481`, `p_size * 64` at `text_server_adv.h:396-403`). The size API takes
 * `int64_t`, so Godot's shaping size is always whole pixels.
 */
// `freetype/src/base/ftobjs.c:3257-3258,3295-3320`: `x_scale = FT_DivFix(sz * 64, unitsPerEm)`.
// `:3350-3361`: `x_ppem = (sz * 64 + 32) >> 6`, the size rounded to whole pixels,
// which `text_server_adv.cpp:1509` divides by for `fd->scale`.
function freeTypeSizeRequest(unitsPerEm: number, fontSizePx: number): { xScale: number; ppem: number } {
  // `req.width = sz * 64.0` lands in an `FT_Long`, truncating toward zero.
  const requested26_6 = Math.trunc(fontSizePx * 64);
  return { xScale: ftDivFix(requested26_6, unitsPerEm), ppem: (requested26_6 + 32) >> 6 };
}

/** `servers/text/text_server.h:172`: the largest font size `SUBPIXEL_POSITIONING_AUTO` still positions subpixel-precisely. */
const SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE = 20;

/**
 * Godot's `subpos` (`text_server_adv.cpp:6936`) under the default
 * `SUBPIXEL_POSITIONING_AUTO` (`text_server_adv.h:343`): true at or below 20 px
 * (`servers/text/text_server.h:172`). When false, `text_server_adv.cpp:7079-7084`
 * rounds every advance to a whole pixel, so a Label at 28 has integer pen positions.
 */
// The other disjunct, `scale != 1.0`, never fires for a whole-pixel size: `fd->scale`
// is `sz / y_ppem` (`text_server_adv.cpp:1509`). A fractional size, which Godot's
// `int64_t` API cannot express, takes the subpixel branch.
export function fontUsesSubpixelPositioning(fontSizePx: number): boolean {
  return !Number.isInteger(fontSizePx) || fontSizePx <= SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE;
}

/**
 * A character's advance in px, through FreeType's and HarfBuzz's fixed-point
 * chain, not the continuous scale: Godot's advance is HarfBuzz's `x_advance`
 * (`text_server_adv.cpp:7077`). A missing glyph takes `averageAdvanceUnits`,
 * so the line does not collapse around it.
 */
// 1. `freetype/src/base/ftadvanc.c:52`: `FT_MulFix(1024 * advance, x_scale)` to 16.16, half up.
// 2. `thirdparty/harfbuzz/src/hb-ft.cc:519,523`: `(v + (1<<9)) >> 10` to 26.6, half up.
//    Unhinted (`hb-ft.cc:115`: `FT_LOAD_DEFAULT | FT_LOAD_NO_HINTING`), the raw-`hmtx` path (`ftadvanc.c:124-131`).
// At 2048 units and 16px this is `ceil(units / 2) / 64`: 1/128 px wider for an odd advance.
export function getFontGlyphAdvancePx(metrics: FontMetrics, ch: string, fontSizePx: number): number {
  const units = metrics.getGlyphAdvanceUnits(ch) ?? metrics.averageAdvanceUnits;
  const { xScale } = freeTypeSizeRequest(metrics.unitsPerEm, fontSizePx);
  const advance16_16 = ftMulFix(1024 * units, xScale);
  // The error only adds width, so a run of odd advances can push
  // `shapedTextSizeWidthPx`'s ceil a whole pixel wider, as in Godot.
  const advance26_6 = Math.floor((advance16_16 + 512) / 1024);
  return advance26_6 / 64;
}

/** `metrics.getKerningAdjustmentUnits(a, b)` scaled to `fontSizePx`. `0` short-circuits without a scale. */
export function getFontKerningAdjustmentPx(metrics: FontMetrics, a: string, b: string, fontSizePx: number): number {
  const units = metrics.getKerningAdjustmentUnits(a, b);
  if (units === 0) return 0;
  return unitsToPx(units, metrics, fontSizePx);
}
