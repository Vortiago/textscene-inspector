// GENERATED FILE — do not hand-edit.
//
// Produced by `scripts/fonts/bake-metrics.mjs` from
// `packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2` (Godot
// 4.6.3's default theme font; upstream commit
// bd7e37632246368c60fdcbd374dbf9bad11969b6 — see THIRD-PARTY-NOTICES.md,
// licence OFL-1.1). Re-run the bake script to regenerate; its `--check` mode
// fails if this file has drifted from the vendored font.

import { firstEndAtOrAbove } from './sfntCmap';

/**
 * Font-wide scalar metrics for OpenSans_SemiBold, in font design units
 * (`unitsPerEm` = 2048), read via `fontkit` from the vendored
 * `.woff2` (decompressed in memory at bake time with `wawoff2`, since
 * fontkit does not decompress woff2 itself — see the bake script's header).
 *
 * `advanceWidths` IS a deliberate duplicate of `openSansAtlas.ts`'s own
 * glyph table's `xadvance` field — the ONE exception to "one bake, one
 * source": that table is the atlas tool's OWN glyph geometry (bitmap
 * placement inside the PNG, at the atlas's bake-size-42 resolution) —
 * `xadvance` is `glyph.advanceWidth * (fontSize / unitsPerEm)` FIXED to
 * that bake size (msdf-bmfont-xml's `index.js:400`), where THIS one is the
 * RAW `hmtx` value, quantized by nothing and at no size — see
 * `getGlyphAdvanceUnits`'s own doc for why a shaper never wants the ATLAS's
 * copy.
 */
interface OpenSansMetrics {
  /** `font.unitsPerEm` (fontkit) — hhea/head design units per em. */
  unitsPerEm: number;
  /** hhea ascender, design units (positive, upward). */
  ascent: number;
  /** hhea descender MAGNITUDE, design units (fontkit reports it negative; stored positive here). */
  descent: number;
  /** hhea lineGap, design units. */
  lineGap: number;
  /**
   * GPOS/kern pairwise advance adjustment, design units, keyed by the
   * two-character pair (e.g. `"AV"`). Empty for OpenSans_SemiBold's baked
   * charset product — this font carries only `mark`/`mkmk` GPOS features, no
   * `kern` feature and no legacy `kern` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
  /**
   * Per-glyph `hmtx` advance width, design units, keyed by character — the
   * SAME `CHARSET` `openSansAtlas.ts` bakes, read directly via `fontkit`'s
   * `Glyph#advanceWidth` (`bake-metrics.mjs`'s own `bakeAdvanceWidths`
   * doc has the full citation for why this is the correct source and
   * `openSansAtlas.ts`'s `xadvance` is not). `getGlyphAdvanceUnits` is the
   * only intended reader.
   */
  advanceWidths: Record<string, number>;
  /**
   * `post` table `underlinePosition`, design units — the TOP EDGE of the
   * underline stroke relative to the baseline, POSITIVE = above baseline (the
   * `post` table's own Y-up convention; typically negative for a
   * below-baseline underline). Read via `fontkit`'s
   * `TTFFont#underlinePosition` (`fontkit/src/TTFFont.js:192-194`, itself
   * `post.underlinePosition`).
   *
   * This is the RAW table value, NOT FreeType's `face->underline_position`:
   * FreeType re-bases it from that top edge onto the stroke's CENTRE before
   * publishing it (`freetype/src/sfnt/sfobjs.c:1424-1425`), which is the
   * value `text_server_adv.cpp:1517` then scales. `getUnderlinePositionPx`
   * applies that conversion; nothing should read this field without it.
   */
  underlinePosition: number;
  /** `post` table `underlineThickness`, design units — FreeType publishes it unchanged (`sfobjs.c:1426`); scaled by `text_server_adv.cpp:1518`. */
  underlineThickness: number;
  /**
   * OS/2 `xAvgCharWidth`, design units — this font's own "typical glyph
   * width" metric, used ONLY as `textLayout.ts`'s fallback advance for a
   * character outside `OPEN_SANS_ATLAS_GLYPHS`/`advanceWidths` (see that
   * table's own doc in the atlas module).
   */
  averageAdvanceUnits: number;
  /** The code points the whole font maps to a glyph, as ascending `[first, last]` ranges, beyond the baked charset. */
  codePointRanges: [number, number][];
}

export const OPEN_SANS_METRICS: OpenSansMetrics = {"unitsPerEm":2048,"ascent":2189,"descent":600,"lineGap":0,"kerning":{},"advanceWidths":{"0":1171,"1":1171,"2":1171,"3":1171,"4":1171,"5":1171,"6":1171,"7":1171,"8":1171,"9":1171," ":532,"!":564,"\"":892,"#":1323,"$":1171,"%":1769,"&":1514,"'":497,"(":649,")":649,"*":1122,"+":1171,",":557,"-":659,".":561,"/":799,":":561,";":561,"<":1171,"=":1171,">":1171,"?":931,"@":1837,"A":1354,"B":1350,"C":1298,"D":1501,"E":1143,"F":1091,"G":1486,"H":1539,"I":625,"J":614,"K":1307,"L":1113,"M":1887,"N":1604,"O":1612,"P":1259,"Q":1612,"R":1308,"S":1126,"T":1157,"U":1521,"V":1276,"W":1936,"X":1275,"Y":1212,"Z":1179,"[":674,"\\":799,"]":674,"^":1171,"_":870,"`":655,"a":1188,"b":1275,"c":1017,"d":1275,"e":1180,"f":741,"g":1135,"h":1301,"i":571,"j":571,"k":1173,"l":571,"m":1954,"n":1301,"o":1250,"p":1275,"q":1275,"r":884,"s":997,"t":810,"u":1301,"v":1094,"w":1670,"x":1128,"y":1096,"z":980,"{":788,"|":1127,"}":788,"~":1171," ":532,"¡":564,"¢":1171,"£":1171,"¤":1171,"¥":1171,"¦":1127,"§":1024,"¨":1215,"©":1704,"ª":754,"«":1138,"¬":1171,"®":1704,"¯":1024,"°":877,"±":1171,"²":744,"³":744,"´":655,"µ":1309,"¶":1341,"·":561,"¸":437,"¹":744,"º":780,"»":1138,"¼":1608,"½":1682,"¾":1663,"¿":931,"À":1354,"Á":1354,"Â":1354,"Ã":1354,"Ä":1354,"Å":1354,"Æ":1864,"Ç":1298,"È":1143,"É":1143,"Ê":1143,"Ë":1143,"Ì":625,"Í":625,"Î":625,"Ï":625,"Ð":1501,"Ñ":1604,"Ò":1612,"Ó":1612,"Ô":1612,"Õ":1612,"Ö":1612,"×":1171,"Ø":1612,"Ù":1521,"Ú":1521,"Û":1521,"Ü":1521,"Ý":1212,"Þ":1259,"ß":1366,"à":1188,"á":1188,"â":1188,"ã":1188,"ä":1188,"å":1188,"æ":1822,"ç":1017,"è":1180,"é":1180,"ê":1180,"ë":1180,"ì":571,"í":571,"î":571,"ï":571,"ð":1248,"ñ":1301,"ò":1250,"ó":1250,"ô":1250,"õ":1250,"ö":1250,"÷":1171,"ø":1250,"ù":1301,"ú":1301,"û":1301,"ü":1301,"ý":1096,"þ":1275,"ÿ":1096,"•":770,"…":1672,"–":1024,"—":2048,"‘":396,"’":396,"“":813,"”":813},"underlinePosition":-100,"underlineThickness":50,"averageAdvanceUnits":1214,"codePointRanges":[[0,0],[13,13],[32,126],[160,383],[402,402],[416,417],[431,432],[490,493],[496,496],[506,511],[536,539],[567,567],[601,601],[700,700],[710,711],[713,713],[728,733],[755,755],[768,772],[774,780],[783,783],[786,786],[803,803],[806,808],[900,906],[908,908],[910,929],[931,974],[977,978],[982,982],[1024,1158],[1160,1299],[1456,1470],[1473,1474],[1479,1479],[1488,1514],[7680,7681],[7742,7743],[7808,7813],[7838,7838],[7840,7929],[8013,8013],[8158,8158],[8192,8203],[8211,8213],[8215,8222],[8224,8226],[8230,8230],[8240,8240],[8242,8243],[8249,8250],[8252,8252],[8260,8260],[8304,8304],[8308,8314],[8316,8330],[8332,8334],[8341,8348],[8355,8356],[8359,8359],[8362,8364],[8453,8453],[8467,8467],[8470,8470],[8480,8480],[8482,8482],[8486,8486],[8494,8494],[8539,8542],[8706,8706],[8710,8710],[8719,8719],[8721,8722],[8725,8725],[8730,8730],[8734,8734],[8747,8747],[8776,8776],[8800,8800],[8804,8805],[9674,9674],[42931,42933],[43859,43859],[64256,64260],[64298,64310],[64312,64316],[64318,64318],[64320,64321],[64323,64324],[64326,64331],[65279,65279],[65532,65533]]};

/** `OPEN_SANS_METRICS.kerning[a + b] ?? 0` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * A baked character's own `hmtx` advance width, design units, or `null`
 * outside `advanceWidths` (the same charset as `OPEN_SANS_ATLAS_GLYPHS` —
 * `textLayout.ts`'s `glyphAdvancePx` falls back to `averageAdvanceUnits` in
 * that case).
 *
 * This is the RAW design-unit value, at no size and quantized by nothing —
 * never `openSansAtlas.ts`'s own `xadvance`, which is msdf-bmfont-xml's OWN
 * atlas-bake-resolution glyph table, fixed to bake size 42
 * (`glyph.advanceWidth * (fontSize / unitsPerEm)`, msdf-bmfont-xml's
 * `index.js:400`) before this repo's bake script ever reads it back. Scaling
 * that bake-size-42 value down to a UI font size (14-28px) does not reproduce
 * HarfBuzz's own target-size shaping, and the error accumulates roughly
 * linearly with line length.
 *
 * Godot's own per-glyph advance is quantized too, just at the TARGET size
 * rather than the atlas's: `text_server_adv.cpp:7077` reads HarfBuzz's
 * `x_advance`, which `thirdparty/harfbuzz/src/hb-ft.cc:523` has already
 * rounded to a whole number of 1/64 px (26.6) after
 * `thirdparty/freetype/src/base/ftadvanc.c:52` scaled THIS table's raw value
 * by FreeType's `x_scale`; and above
 * `SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE` (20px, `servers/text/
 * text_server.h:172`) `text_server_adv.cpp:7080` rounds it again, to a
 * whole pixel. Neither rounding can be baked into this table — both depend
 * on the size the text is shaped at — so both live in
 * `fontMetrics.ts`/`textLayout.ts`, and this getter stays raw.
 */
export function getGlyphAdvanceUnits(ch: string): number | null {
  return OPEN_SANS_METRICS.advanceWidths[ch] ?? null;
}

/** Whether the whole font, not only the baked charset, has a glyph for `ch`: Godot's default font draws it. */
export function hasGlyph(ch: string): boolean {
  const codePoint = ch.codePointAt(0)!;
  const ranges = OPEN_SANS_METRICS.codePointRanges;
  const i = firstEndAtOrAbove(ranges.length, (k) => ranges[k]![1], codePoint);
  return i < ranges.length && ranges[i]![0] <= codePoint;
}

/**
 * Downward pixel offset from a line's baseline to the CENTRE of its underline
 * stroke — Godot's `shaped_text_get_underline_position`, which a stroke
 * drawer (`rich_text_label.cpp:1242-1244`'s `y_off = upos`) adds straight
 * onto the baseline y with no further sign flip.
 *
 * Two conversions sit between the `post` table and that number, and dropping
 * either moves the rule a whole pixel row at UI sizes:
 *
 * 1. `freetype/src/sfnt/sfobjs.c:1424-1425` — FreeType re-bases the table's
 *    TOP-EDGE convention onto the stroke's centre before publishing
 *    `face->underline_position`:
 *    `post.underlinePosition - post.underlineThickness / 2`, an integer
 *    division on `FT_Short`. Half a stroke is only a fraction of a pixel at
 *    a UI size, but the rule is snapped to whole rows downstream, so it is
 *    the fraction that decides which row.
 * 2. `text_server_adv.cpp:1517` — `(-FT_MulFix(face->underline_position,
 *    size->metrics.y_scale) / 64.0) * fd->scale`, a plain proportional scale
 *    (NOT ceiling-rounded like ascent/descent), NEGATED so a below-baseline
 *    (negative) table value becomes a positive DOWNWARD offset.
 *
 * FreeType's own scale quantizes to 26.6 fixed point, which this does not
 * reproduce — the same approximation `getFontAscentPx` already makes, and
 * bounded by 1/64 px (0.016), well under the half-pixel that would move a
 * snapped row at any size this atlas serves.
 *
 * At size 16: -(-100 - 50/2) * 16/2048 = 0.9765625.
 */
export function getUnderlinePositionPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  const centreUnits =
    OPEN_SANS_METRICS.underlinePosition - Math.trunc(OPEN_SANS_METRICS.underlineThickness / 2);
  return -centreUnits * scale;
}

/**
 * `text_server_adv.cpp:1518`, scaled the same way as `getUnderlinePositionPx`
 * (no negation — a thickness has no sign to flip). The MINIMUM 1px stroke
 * width (`rich_text_label.cpp:1243`: `MAX(1.0, uth * theme_cache.base_scale)`)
 * is the CALLER's job, not baked in here — `base_scale` is a UI content-scale
 * factor this renderer does not thread through text metrics, and every fixture
 * this atlas serves renders at its default (1.0), where the max is a no-op
 * unless the font's own thickness already exceeds 1px.
 *
 * At size 16: 50 * 16/2048 = 0.390625.
 */
export function getUnderlineThicknessPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.underlineThickness * scale;
}
