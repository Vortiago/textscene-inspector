/**
 * The font-metrics contract the native Control text engine shapes against, and the px quantisation
 * every implementation shares, from design-unit data alone. The whole-pixel advance round above the
 * subpixel threshold carries a remainder, so it lives in `textLayout.ts`. This module imports only
 * `perObject`, so no consumer pulls in Open Sans's baked data.
 */

import { perObject } from '../../../../utils/perObject';

/**
 * Which glyph-painting path a `FontMetrics` pairs with, since shaping is
 * font-agnostic but rasterisation is not. `'atlas'` is a baked MSDF atlas
 * (`openSansFontMetrics.ts`), the only kind `GlyphPlacement.glyph` looks up.
 * `'canvas'` is a runtime-loaded scene font (`runtimeFontMetrics.ts`) drawn through canvas-2D.
 */
type FontMetricsKind = 'atlas' | 'canvas';

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
  /** `FontVariation.variation_embolden` of this face. Absent is 0, no embolden. */
  readonly embolden?: number;
  /**
   * The shear of `FontVariation.variation_transform` of this face: its `Transform2D` x basis `y`,
   * `FT_Matrix.xy` (`text_server_adv.cpp:1318-1320`). A glyph moves right by `skew` per px above
   * the baseline. Absent is 0, upright.
   */
  readonly skew?: number;
}

/**
 * `units` scaled to `fontSizePx` as `units * (fontSizePx / unitsPerEm)`, which `units * fontSizePx
 * / unitsPerEm` matches bit for bit only at a power-of-two `unitsPerEm`. No rule stops at this
 * float: ascent and descent ceil to whole pixels, and an advance goes through FreeType's and
 * HarfBuzz's fixed-point chain to whole 1/64 px.
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
export function getFontAscentPx(
  metrics: Pick<FontMetrics, 'ascent' | 'unitsPerEm'>,
  fontSizePx: number
): number {
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
export const FIXED_16_16_ONE = 65536;

/**
 * `freetype/include/freetype/fttypes.h`'s `FT_DivFix` (`freetype/src/base/ftcalc.c`):
 * `a / b` in 16.16, rounded half up on the magnitude (`q = ( ( (FT_UInt64)a << 16 ) +
 * ( b >> 1 ) ) / b`), then signed. A division, not a shift: the intermediate exceeds 32 bits.
 * A zero divisor gives the largest 32-bit magnitude, signed by `a`, not infinity.
 */
export function ftDivFix(a: number, b: number): number {
  if (b === 0) return a < 0 ? -0x7fffffff : 0x7fffffff;
  const sign = Math.sign(a) * Math.sign(b);
  const magnitude = Math.floor((Math.abs(a) * FIXED_16_16_ONE + Math.floor(Math.abs(b) / 2)) / Math.abs(b));
  return sign * magnitude;
}

/** `freetype/src/base/ftcalc.c`'s `FT_MulFix`: `a * b / 65536`, rounded half up on the magnitude. */
export function ftMulFix(a: number, b: number): number {
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

/**
 * FreeType's `x_scale` for `fontSizePx`: the 16.16 factor that takes a design-unit coordinate to 26.6
 * px (`FT_MulFix(units, scale)`), which scales every outline point Godot reads
 * (`text_server_adv.cpp:3613`, `FT_Load_Glyph`).
 */
export function getFontOutlineScale(unitsPerEm: number, fontSizePx: number): number {
  return freeTypeSizeRequest(unitsPerEm, fontSizePx).xScale;
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

/**
 * The wrappers of one face, by embolden and skew: one each, so a layout memoised on `FontMetrics`
 * identity keeps its hits.
 */
const variationsOf = perObject((_face: FontMetrics) => new Map<string, FontMetrics>());

/**
 * `metrics` with a `FontVariation`'s `embolden` and `skew` set. The wrapper reads every other field
 * through the face, so a live getter stays live. With neither, it is the face itself.
 */
export function withVariation(
  metrics: FontMetrics,
  { embolden = 0, skew = 0 }: { embolden?: number; skew?: number }
): FontMetrics {
  if (embolden === 0 && skew === 0) return metrics;
  const byVariation = variationsOf(metrics);
  const key = `${embolden}/${skew}`;
  let wrapped = byVariation.get(key);
  if (!wrapped)
    byVariation.set(
      key,
      (wrapped = Object.create(metrics, { embolden: { value: embolden }, skew: { value: skew } }))
    );
  return wrapped!;
}

/**
 * The px an embolden adds to every advance: `embolden * size.x / 4096` with `size.x` in 26.6
 * (`text_server_adv.cpp:3238-3239`), so `embolden * fontSizePx / 64`.
 */
export function getFontExtraAdvancePx(embolden: number, fontSizePx: number): number {
  return (embolden * fontSizePx) / 64;
}

/** `getFontGlyphAdvancePx` plus the face's own embolden: the advance `get_char_size` reports for a `FontVariation`. */
export function getFontEmboldenedAdvancePx(metrics: FontMetrics, ch: string, fontSizePx: number): number {
  return (
    getFontGlyphAdvancePx(metrics, ch, fontSizePx) + getFontExtraAdvancePx(metrics.embolden ?? 0, fontSizePx)
  );
}

/**
 * The px `FT_Outline_Embolden` grows an outline by: `strength = embolden * size.x / 16` in 26.6
 * (`text_server_adv.cpp:1313-1314`). The ink keeps its left and bottom edges and gains this much
 * at the right and top.
 */
export function getFontEmboldenGrowthPx(embolden: number, fontSizePx: number): number {
  return (embolden * fontSizePx) / 16;
}

/** `metrics.getKerningAdjustmentUnits(a, b)` scaled to `fontSizePx`. `0` short-circuits without a scale. */
export function getFontKerningAdjustmentPx(
  metrics: FontMetrics,
  a: string,
  b: string,
  fontSizePx: number
): number {
  const units = metrics.getKerningAdjustmentUnits(a, b);
  if (units === 0) return 0;
  return unitsToPx(units, metrics, fontSizePx);
}
