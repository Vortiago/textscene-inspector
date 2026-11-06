/**
 * The font-metrics contract the native Control text engine shapes against, and the px quantisation
 * every implementation shares, from design-unit data alone. The whole-pixel advance round above the
 * subpixel threshold carries a remainder, so it lives in `textLayout.ts`. This module imports only
 * object caches from `utils`, so no consumer pulls in Open Sans's baked data.
 */

import { perObject } from '../../../../utils/perObject';
import { identityKey } from '../../../../utils/identityKey';
import { recentlyRead } from '../../../../utils/recentlyRead';
import type { Decomposition } from './sfntDecomposition';
import type { SfntOutlines } from './sfntOutlines';

/**
 * Which glyph-painting path a `FontMetrics` pairs with, since shaping is
 * font-agnostic but rasterisation is not. `'atlas'` is a baked MSDF atlas
 * (`openSansFontMetrics.ts`), the only kind `GlyphPlacement.glyph` looks up.
 * `'canvas'` is a runtime-loaded scene font (`runtimeFontMetrics.ts`) drawn through canvas-2D.
 * `'bitmap'` is a BMFont (`bitmapFontMetrics.ts`) drawn from its page images.
 */
type FontMetricsKind = 'atlas' | 'canvas' | 'bitmap';

/**
 * Raw, design-unit font metrics a shaper needs. The functions below scale them
 * through `unitsPerEm` and `fontSizePx`. An implementation never scales them itself.
 */
export interface FontMetrics {
  /** Which glyph-painting path this metrics object pairs with. */
  readonly kind: FontMetricsKind;
  /**
   * The px one design unit is drawn at, `fontSizePx / unitsPerEm` when absent. Only a fixed-size
   * font sets it, as Godot scales it by its scale mode, and then no FreeType rounding applies to
   * its ascent, descent, advance or kerning.
   */
  readonly pxPerUnit?: (fontSizePx: number) => number;
  /** Design units per em (`hhea`/`head` table `unitsPerEm`): the scale denominator for every raw unit below. */
  readonly unitsPerEm: number;
  /** `hhea` ascender, design units (positive, upward), before `getFontAscentPx` rounds it. */
  readonly ascent: number;
  /** `hhea` descender magnitude, design units (positive), before `getFontLinePitchPx` rounds it. */
  readonly descent: number;
  /** Whether the face maps `ch` to a glyph, `_font_has_char`. A face that cannot tell answers true. */
  hasGlyph(ch: string): boolean;
  /**
   * The base and marks a character the face lacks draws as, where the face has the pieces of its
   * canonical decomposition, at a font size. Absent, or null for a character, is one glyph.
   */
  readonly decomposition?: Decomposition;
  /** A character's own advance width, design units, or `null` if this font has no glyph for it (a shaper falls back to `averageAdvanceUnits`). */
  getGlyphAdvanceUnits(ch: string): number | null;
  /**
   * The rest of the face's **Fallback chain**, in order. A character the face lacks draws from the
   * first of them that has it. The list is flat: the `fallbacks` of an entry are not read. Absent is none.
   */
  readonly fallbacks?: readonly FontMetrics[];
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
  /**
   * `FontVariation.variation_opentype` of this face, where its `outlines` draw an instance other than
   * the default. Absent is the default instance.
   */
  readonly opentype?: OpentypeCoordinates;
  /**
   * The glyph outlines that the text of an emboldened, sheared or varied canvas face follows. Absent
   * for a face that needs none. Null for a font whose outlines this previewer cannot read: its text
   * stays on `fillText` and `strokeText`.
   */
  readonly outlines?: SfntOutlines | null;
}

/**
 * `units` scaled to `fontSizePx` as `units * (fontSizePx / unitsPerEm)`, which `units * fontSizePx
 * / unitsPerEm` matches bit for bit only at a power-of-two `unitsPerEm`. No rule stops at this
 * float: ascent and descent ceil to whole pixels, and an advance goes through FreeType's and
 * HarfBuzz's fixed-point chain to whole 1/64 px.
 */
function unitsToPx(
  units: number,
  metrics: Pick<FontMetrics, 'unitsPerEm' | 'pxPerUnit'>,
  fontSizePx: number
): number {
  return units * (metrics.pxPerUnit?.(fontSizePx) ?? fontSizePx / metrics.unitsPerEm);
}

/**
 * Ascent rounded up to a whole pixel, as FreeType's 26.6 size metrics
 * (`face->size->metrics.ascender`) are (`modules/text_server_adv/text_server_adv.cpp:1515-1516`).
 * A line's baseline sits this far below its top (`rich_text_label.cpp:1049`), and
 * every baseline-relative quantity adds to this value rather than re-deriving it.
 */
export function getFontAscentPx(
  metrics: Pick<FontMetrics, 'ascent' | 'unitsPerEm' | 'pxPerUnit'>,
  fontSizePx: number
): number {
  const ascentPx = unitsToPx(metrics.ascent, metrics, fontSizePx);
  // A fixed-size font returns its cached ascent scaled, with no FreeType round (`:2907-2912`).
  return metrics.pxPerUnit ? ascentPx : Math.ceil(ascentPx);
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
  metrics: Pick<FontMetrics, 'ascent' | 'descent' | 'unitsPerEm' | 'pxPerUnit'>,
  fontSizePx: number,
  lineSpacingPx: number
): number {
  // A fixed-size font sums its scaled ascent and descent, and the shaped size ceils the sum
  // (`text_server_adv.cpp:7524-7537`).
  if (metrics.pxPerUnit) {
    return Math.ceil(unitsToPx(metrics.ascent + metrics.descent, metrics, fontSizePx)) + lineSpacingPx;
  }
  const ascentPx = getFontAscentPx(metrics, fontSizePx);
  const descentPx = Math.ceil(unitsToPx(metrics.descent, metrics, fontSizePx));
  return ascentPx + descentPx + lineSpacingPx;
}

/**
 * Descent at `fontSizePx`: pitch less ascent at zero spacing, so `getFontLinePitchPx` keeps the one
 * reading of the ceiling rule (`text_server_adv.cpp:1515-1516`).
 */
export function getFontDescentPx(
  metrics: Pick<FontMetrics, 'ascent' | 'descent' | 'unitsPerEm' | 'pxPerUnit'>,
  fontSizePx: number
): number {
  return getFontLinePitchPx(metrics, fontSizePx, 0) - getFontAscentPx(metrics, fontSizePx);
}

/** 1.0 in FreeType's 16.16 fixed point (`FT_Fixed`). */
export const FIXED_16_16_ONE = 65536;

/** 1.0 px in FreeType's 26.6 fixed point (`FT_F26Dot6`). */
export const FIXED_26_6_ONE = 64;

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

/**
 * `freetype/src/base/ftcalc.c`'s `FT_MulDiv`: `a * b / c`, rounded half up on the magnitude. A zero
 * `c` gives the largest 32-bit magnitude, signed by `a * b`.
 * @canonical FreeType's `a * b / c` in integers
 */
export function ftMulDiv(a: number, b: number, c: number): number {
  if (c === 0) return a * b < 0 ? -0x7fffffff : 0x7fffffff;
  const sign = Math.sign(a) * Math.sign(b) * Math.sign(c);
  return sign * Math.floor((Math.abs(a) * Math.abs(b) + Math.floor(Math.abs(c) / 2)) / Math.abs(c));
}

/** `freetype/src/base/ftcalc.c`'s `FT_MulFix`: `a * b / 65536`, rounded half up on the magnitude. */
export function ftMulFix(a: number, b: number): number {
  return ftMulDiv(a, b, FIXED_16_16_ONE);
}

/** `FT_PIX_FLOOR`: down to a whole pixel in 26.6. */
export function pixFloor(value: number): number {
  return Math.floor(value / FIXED_26_6_ONE) * FIXED_26_6_ONE;
}

/** `FT_PIX_ROUND`: to the nearest whole pixel in 26.6, half up. */
export function pixRound(value: number): number {
  return pixFloor(value + FIXED_26_6_ONE / 2);
}

/** `FT_PIX_CEIL`: up to a whole pixel in 26.6. */
export function pixCeil(value: number): number {
  return pixFloor(value + FIXED_26_6_ONE - 1);
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
  const requested26_6 = Math.trunc(fontSizePx * FIXED_26_6_ONE);
  return { xScale: ftDivFix(requested26_6, unitsPerEm), ppem: (requested26_6 + 32) >> 6 };
}

/**
 * The ppem and the 16.16 scale of a TrueType glyph load at `fontSizePx` (`ttobjs.c`,
 * `tt_size_reset`). A font whose `head` flags round the ppem scales by the whole-pixel size,
 * which a whole-pixel request already is.
 */
export function freeTypeTrueTypeSize(
  unitsPerEm: number,
  fontSizePx: number,
  isPpemRounded: boolean
): { scale: number; ppem: number } {
  const { xScale, ppem } = freeTypeSizeRequest(unitsPerEm, fontSizePx);
  return { scale: isPpemRounded ? ftDivFix(ppem * FIXED_26_6_ONE, unitsPerEm) : xScale, ppem };
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
/** `servers/text/text_server.h:173`: the largest font size `SUBPIXEL_POSITIONING_AUTO` positions to a quarter pixel. */
const SUBPIXEL_POSITIONING_ONE_QUARTER_MAX_SIZE = 16;

/**
 * Godot's `scale != 1.0` (`text_server_adv.cpp:4082`): a fixed-size font drawn off its own size, or
 * a fractional size, which Godot's `int64_t` API cannot express. A whole-pixel size of an outline
 * font has `fd->scale` `sz / y_ppem` (`text_server_adv.cpp:1509`), so it is never scaled.
 */
export function fontIsScaled(fontSizePx: number, metrics: Pick<FontMetrics, 'pxPerUnit'>): boolean {
  return (metrics.pxPerUnit?.(fontSizePx) ?? 1) !== 1 || !Number.isInteger(fontSizePx);
}

/**
 * Godot's `subpos` (`text_server_adv.cpp:6936`) under the default
 * `SUBPIXEL_POSITIONING_AUTO` (`text_server_adv.h:343`): true at or below 20 px
 * (`servers/text/text_server.h:172`). When false, `text_server_adv.cpp:7079-7084`
 * rounds every advance to a whole pixel, so a Label at 28 has integer pen positions.
 */
export function fontUsesSubpixelPositioning(
  fontSizePx: number,
  metrics: Pick<FontMetrics, 'pxPerUnit'>
): boolean {
  return fontIsScaled(fontSizePx, metrics) || fontSizePx <= SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE;
}

/**
 * Where a canvas item draws a glyph whose pen is at `xPx`: `_font_draw_glyph` floors the pen
 * after a quarter or half step and draws the glyph raster for that step
 * (`text_server_adv.cpp:4024-4029,4074-4084`), so the ink starts on a 1/4, 1/2 or whole pixel.
 * A scaled face (`fontIsScaled`) skips the floor, so its pen stays.
 */
export function canvasGlyphPenXPx(
  xPx: number,
  fontSizePx: number,
  metrics: Pick<FontMetrics, 'pxPerUnit'>
): number {
  if (fontIsScaled(fontSizePx, metrics)) return xPx;
  const stepsPerPx =
    fontSizePx <= SUBPIXEL_POSITIONING_ONE_QUARTER_MAX_SIZE
      ? 4
      : fontSizePx <= SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE
        ? 2
        : 1;
  const halfStepPx = stepsPerPx === 1 ? 0 : 0.5 / stepsPerPx;
  return Math.floor(stepsPerPx * (xPx + halfStepPx)) / stepsPerPx;
}

/**
 * A character's advance in px, through FreeType's and HarfBuzz's fixed-point
 * chain, not the continuous scale: Godot's advance is HarfBuzz's `x_advance`
 * (`text_server_adv.cpp:7077`). A missing glyph takes `averageAdvanceUnits`,
 * so the line does not collapse around it.
 */
// A face at a variable-font instance takes its advance from `SfntOutlines.advanceAtInstance` instead.
export function getFontGlyphAdvancePx(metrics: FontMetrics, ch: string, fontSizePx: number): number {
  const units = metrics.getGlyphAdvanceUnits(ch) ?? metrics.averageAdvanceUnits;
  // A bitmap font's advance reaches HarfBuzz in 26.6 as `advance * 64` and leaves as
  // `advance * scale` (`text_server_adv.cpp:130,7077`): no FreeType chain.
  if (metrics.pxPerUnit) return unitsToPx(units, metrics, fontSizePx);
  const advanceAtInstance = instanceGlyphAdvance26_6(metrics, ch, fontSizePx);
  if (advanceAtInstance !== null) return advanceAtInstance / FIXED_26_6_ONE;
  // The error only adds width, so a run of odd advances can push
  // `shapedTextSizeWidthPx`'s ceil a whole pixel wider, as in Godot.
  return glyphAdvance26_6(units, metrics.unitsPerEm, fontSizePx) / FIXED_26_6_ONE;
}

// 1. `freetype/src/base/ftadvanc.c:52`: `FT_MulFix(1024 * advance, x_scale)` to 16.16, half up.
// 2. `thirdparty/harfbuzz/src/hb-ft.cc:519,523`: `(v + (1<<9)) >> 10` to 26.6, half up.
//    Unhinted (`hb-ft.cc:115`: `FT_LOAD_DEFAULT | FT_LOAD_NO_HINTING`), the raw-`hmtx` path (`ftadvanc.c:124-131`).
// At 2048 units and 16px this is `ceil(units / 2) / 64`: 1/128 px wider for an odd advance.
/** An advance of `units` in 26.6, through the two steps above. */
export function glyphAdvance26_6(units: number, unitsPerEm: number, fontSizePx: number): number {
  const { xScale } = freeTypeSizeRequest(unitsPerEm, fontSizePx);
  const advance16_16 = ftMulFix(1024 * units, xScale);
  return Math.floor((advance16_16 + 512) / 1024);
}

/**
 * A signed offset of `units` at `fontSizePx`, in px. FreeType scales a negative value as its
 * magnitude and negates it (`FT_MulFix`), which `glyphAdvance26_6` alone does not for a sign.
 */
export function glyphOffsetPx(units: number, unitsPerEm: number, fontSizePx: number): number {
  return (Math.sign(units) * glyphAdvance26_6(Math.abs(units), unitsPerEm, fontSizePx)) / FIXED_26_6_ONE;
}

/**
 * The advance in 26.6 of `ch` at the axis values of the face's `variation_opentype`, or null for a
 * face at its default instance and a character with no glyph: the default advance stands.
 */
function instanceGlyphAdvance26_6(metrics: FontMetrics, ch: string, fontSizePx: number): number | null {
  const { outlines, opentype } = metrics;
  if (!outlines || !isInstanced(opentype)) return null;
  const glyphIndex = outlines.glyphIndex(ch.codePointAt(0)!, opentype);
  return glyphIndex === 0 ? null : (outlines.advanceAtInstance?.(glyphIndex, fontSizePx, opentype) ?? null);
}

/**
 * A `variation_opentype` dictionary: the value of each axis it names, under the axis tag as an
 * integer or under the axis name as a string. A number that the key's axis does not take is ignored.
 */
export type OpentypeCoordinates = ReadonlyMap<number | string, number>;

/** The embolden, the shear and the axis values of a `FontVariation`: absent is none. */
export type GlyphVariation = Pick<FontMetrics, 'embolden' | 'skew' | 'opentype'>;

/** Whether `opentype` names an axis value, so the face is drawn at a variable-font instance. */
export function isInstanced(opentype: OpentypeCoordinates | undefined): opentype is OpentypeCoordinates {
  return !!opentype?.size;
}

/** Whether the variation changes the glyph outline at all. */
function isGlyphVaried({ embolden = 0, skew = 0, opentype }: GlyphVariation): boolean {
  return embolden !== 0 || skew !== 0 || isInstanced(opentype);
}

/** The axis values as one string, in key order, so two dictionaries of one content share a key. */
export function opentypeKey(opentype: OpentypeCoordinates | undefined): string {
  return [...(opentype ?? [])]
    .map(([key, value]) => `${typeof key === 'number' ? key : JSON.stringify(key)}=${value}`)
    .sort()
    .join(',');
}

/** One string for a variation, with an absent embolden and skew equal to 0: the key of every cache that varies by it. */
export function variationKey({ embolden = 0, skew = 0, opentype }: GlyphVariation): string {
  return `${embolden}/${skew}/${opentypeKey(opentype)}`;
}

/**
 * Each wrapper holds its `opentype`, which keys the kept instances and kerning, so a `variation_opentype`
 * animation drops the wrapper read least recently past this count.
 */
const MAX_KEPT_VARIATIONS = 32;

/**
 * The wrappers of one face, by embolden, skew and axis values, then by outlines: one each, so a layout memoised on
 * `FontMetrics` identity keeps its hits.
 */
const variationsOf = perObject((_face: FontMetrics) =>
  recentlyRead<string, Map<FontMetrics['outlines'], FontMetrics>>(MAX_KEPT_VARIATIONS)
);

const newWrappersByOutlines = (): Map<FontMetrics['outlines'], FontMetrics> => new Map();

/**
 * `metrics` with a `FontVariation`'s `embolden`, `skew` and `opentype` set, and the `outlines` its text follows.
 * The wrapper reads every other field through the face, so a live getter stays live. With no variation
 * and no outlines, it is the face itself. Two fonts that share a face and a variation keep
 * their own outlines, each on its own wrapper. The advances and the kerning follow the instance
 * that the axis values name, and the glyphs draw it where `drawnOpentype` gives them.
 * A variation of a wrapper replaces its variation and keeps its outlines, as a `FontVariation` over
 * another finds its face at its own values alone (`font.cpp:3120-3131`).
 */
export function withVariation<Metrics extends FontMetrics>(
  metrics: Metrics,
  {
    embolden = 0,
    skew = 0,
    opentype,
    outlines = metrics.outlines,
  }: GlyphVariation & Pick<FontMetrics, 'outlines'>
): Metrics {
  if (!outlines && !isGlyphVaried({ embolden, skew, opentype })) return metrics;
  const byOutlines = variationsOf(metrics)(variationKey({ embolden, skew, opentype }), newWrappersByOutlines);
  let wrapped = byOutlines.get(outlines);
  if (!wrapped) {
    wrapped = Object.create(metrics, {
      embolden: { value: embolden },
      skew: { value: skew },
      opentype: { value: opentype },
      ...(outlines !== undefined && { outlines: { value: outlines } }),
    }) as FontMetrics;
    byOutlines.set(outlines, wrapped);
  }
  return wrapped as Metrics;
}

/**
 * The axis values of `metrics` where its outlines draw them as an instance other than the default,
 * else undefined: at the default, FreeType and HarfBuzz draw the font itself, so the face draws as
 * the font does without a variation.
 */
export function drawnOpentype({ opentype, outlines }: FontMetrics): OpentypeCoordinates | undefined {
  return isInstanced(opentype) && outlines?.drawsInstance?.(opentype) ? opentype : undefined;
}

/** `metrics` carrying `outlines`, keeping its own variation. */
export function withOutlines<Metrics extends FontMetrics>(
  metrics: Metrics,
  outlines: SfntOutlines
): Metrics & { readonly outlines: SfntOutlines } {
  return (
    metrics.outlines === outlines
      ? metrics
      : withVariation(metrics, {
          embolden: metrics.embolden,
          skew: metrics.skew,
          opentype: metrics.opentype,
          outlines,
        })
  ) as Metrics & { readonly outlines: SfntOutlines };
}

/** `face` and then its `fallbacks`: the order the shaper tries them in. */
export const fallbackChainOf = perObject((face: FontMetrics): readonly FontMetrics[] => [
  face,
  ...(face.fallbacks ?? []),
]);

/** The first face of the **Fallback chain** of `face` that has a glyph for `ch`, or null for none. */
export function firstFaceWithGlyph(face: FontMetrics, ch: string): FontMetrics | null {
  return fallbackChainOf(face).find((entry) => entry.hasGlyph(ch)) ?? null;
}

/** One wrapper per face and fallback list, so a layout memoised on the face keeps its hits. */
const fallbackWrappersOf = perObject((_face: FontMetrics) => new Map<string, FontMetrics>());

/**
 * `face` with `fallbacks` as the rest of its **Fallback chain**. A face in the list twice, or the
 * face itself, is tried once, where it first stands.
 */
export function withFallbacks<Metrics extends FontMetrics>(
  face: Metrics,
  fallbacks: readonly FontMetrics[]
): Metrics {
  if (fallbacks.length === 0) return face;
  const distinct = [...new Set(fallbacks)].filter((fallback) => fallback !== face);
  if (distinct.length === 0) return face;
  const byList = fallbackWrappersOf(face);
  const key = distinct.map(identityKey).join(',');
  let wrapped = byList.get(key);
  if (!wrapped) byList.set(key, (wrapped = Object.create(face, { fallbacks: { value: distinct } })));
  return wrapped as Metrics;
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
 * The width of `tab_size` spaces, at least 1: `MAX(1, tab_size * (space width + SPACING_SPACE))`, a
 * TextEdit tab stop and a RichTextLabel tab stop or indent level. `SPACING_SPACE` is 0 for every loaded font.
 */
export function getFontTabWidthPx(metrics: FontMetrics, tabSize: number, fontSizePx: number): number {
  return Math.max(1, tabSize * getFontEmboldenedAdvancePx(metrics, ' ', fontSizePx));
}

/** One repeating stop of `getFontTabWidthPx`, or none: `tab_size <= 0` skips tab alignment. */
export function getFontTabStopsPx(metrics: FontMetrics, tabSize: number, fontSizePx: number): number[] {
  return tabSize <= 0 ? [] : [getFontTabWidthPx(metrics, tabSize, fontSizePx)];
}

/**
 * The px `FT_Outline_Embolden` grows an outline by: `strength = embolden * size.x / 16` in 26.6
 * (`text_server_adv.cpp:1314-1315`). The ink keeps its left and bottom edges and gains this much
 * at the right and top.
 */
export function getFontEmboldenGrowthPx(embolden: number, fontSizePx: number): number {
  return (embolden * fontSizePx) / 16;
}

/**
 * The strength Godot passes to `FT_Outline_Embolden`: `embolden * size.x / 16`, truncated, in 26.6
 * units, with `size.x` the font size in 26.6 (`text_server_adv.cpp:1314`). A float product, as
 * `embolden` is a `float`. `getFontEmboldenGrowthPx` is the same strength before the truncation.
 */
export function getFontEmboldenStrength(embolden: number, fontSizePx: number): number {
  return Math.trunc(Math.fround(Math.fround(embolden) * fontSizePx * FIXED_26_6_ONE) / 16);
}

/**
 * The kerning of `a` and `b` scaled to `fontSizePx`: the `GPOS` kerning of the instance at the face's
 * `variation_opentype`, else `metrics.getKerningAdjustmentUnits(a, b)`. `0` short-circuits without a scale.
 */
export function getFontKerningAdjustmentPx(
  metrics: FontMetrics,
  a: string,
  b: string,
  fontSizePx: number
): number {
  const units = instanceKerningUnits(metrics, a, b) ?? metrics.getKerningAdjustmentUnits(a, b);
  if (units === 0) return 0;
  return unitsToPx(units, metrics, fontSizePx);
}

/**
 * The kerning in design units of `a` and `b` at the axis values of the face's `variation_opentype`,
 * or null for a face at its default instance and a character with no glyph: the default kerning stands.
 */
function instanceKerningUnits(metrics: FontMetrics, a: string, b: string): number | null {
  const { outlines, opentype } = metrics;
  if (!outlines?.kerningAtInstance || !isInstanced(opentype)) return null;
  return outlines.kerningAtInstance(a.codePointAt(0)!, b.codePointAt(0)!, opentype);
}
