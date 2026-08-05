// GENERATED FILE — do not hand-edit.
//
// Produced by `scripts/fonts/bake-metrics.mjs` from
// `packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2` (Godot
// 4.6.3's default theme font; upstream commit
// bd7e37632246368c60fdcbd374dbf9bad11969b6 — see THIRD-PARTY-NOTICES.md,
// licence OFL-1.1). Re-run the bake script to regenerate; its `--check` mode
// fails if this file has drifted from the vendored font.

/**
 * Font-wide scalar metrics for OpenSans_SemiBold, in font design units
 * (`unitsPerEm` = 2048), read via `fontkit` from the vendored
 * `.woff2` (decompressed in memory at bake time with `wawoff2`, since
 * fontkit does not decompress woff2 itself — see the bake script's header).
 *
 * `advanceWidths` IS a deliberate duplicate of `openSansAtlas.ts`'s own
 * glyph table's `xadvance` field — the ONE exception to "one bake, one
 * source": that table is the atlas tool's OWN glyph geometry (bitmap
 * placement inside the PNG, at the atlas's bake-size-42 resolution), rounded
 * to whole atlas-bake pixels by msdf-bmfont-xml itself before this script
 * ever reads it back, where THIS advance is a direct, unrounded `hmtx` scale
 * — see `getGlyphAdvanceUnits`'s own doc for why a shaper never wants the
 * ATLAS's rounded copy.
 */
export interface OpenSansMetrics {
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
   * `post` table `underlinePosition`, design units — the top of the underline
   * stroke relative to the baseline, POSITIVE = above baseline (the `post`
   * table's own Y-up convention; typically negative for a below-baseline
   * underline). Read via `fontkit`'s `TTFFont#underlinePosition`
   * (`fontkit/src/TTFFont.js:192-194`, itself `post.underlinePosition`),
   * matching FreeType's `face->underline_position` — the same field
   * `text_server_adv.cpp:1517` scales to pixels for `shaped_text_get_underline_position`.
   */
  underlinePosition: number;
  /** `post` table `underlineThickness`, design units — see `underlinePosition`'s doc; scaled by `text_server_adv.cpp:1518`. */
  underlineThickness: number;
  /**
   * OS/2 `xAvgCharWidth`, design units — this font's own "typical glyph
   * width" metric, used ONLY as `textLayout.ts`'s fallback advance for a
   * character outside `OPEN_SANS_ATLAS_GLYPHS`/`advanceWidths` (see that
   * table's own doc in the atlas module).
   */
  averageAdvanceUnits: number;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = {"unitsPerEm":2048,"ascent":2189,"descent":600,"lineGap":0,"kerning":{},"advanceWidths":{"0":1171,"1":1171,"2":1171,"3":1171,"4":1171,"5":1171,"6":1171,"7":1171,"8":1171,"9":1171," ":532,"!":564,"\"":892,"#":1323,"$":1171,"%":1769,"&":1514,"'":497,"(":649,")":649,"*":1122,"+":1171,",":557,"-":659,".":561,"/":799,":":561,";":561,"<":1171,"=":1171,">":1171,"?":931,"@":1837,"A":1354,"B":1350,"C":1298,"D":1501,"E":1143,"F":1091,"G":1486,"H":1539,"I":625,"J":614,"K":1307,"L":1113,"M":1887,"N":1604,"O":1612,"P":1259,"Q":1612,"R":1308,"S":1126,"T":1157,"U":1521,"V":1276,"W":1936,"X":1275,"Y":1212,"Z":1179,"[":674,"\\":799,"]":674,"^":1171,"_":870,"`":655,"a":1188,"b":1275,"c":1017,"d":1275,"e":1180,"f":741,"g":1135,"h":1301,"i":571,"j":571,"k":1173,"l":571,"m":1954,"n":1301,"o":1250,"p":1275,"q":1275,"r":884,"s":997,"t":810,"u":1301,"v":1094,"w":1670,"x":1128,"y":1096,"z":980,"{":788,"|":1127,"}":788,"~":1171," ":532,"¡":564,"¢":1171,"£":1171,"¤":1171,"¥":1171,"¦":1127,"§":1024,"¨":1215,"©":1704,"ª":754,"«":1138,"¬":1171,"®":1704,"¯":1024,"°":877,"±":1171,"²":744,"³":744,"´":655,"µ":1309,"¶":1341,"·":561,"¸":437,"¹":744,"º":780,"»":1138,"¼":1608,"½":1682,"¾":1663,"¿":931,"À":1354,"Á":1354,"Â":1354,"Ã":1354,"Ä":1354,"Å":1354,"Æ":1864,"Ç":1298,"È":1143,"É":1143,"Ê":1143,"Ë":1143,"Ì":625,"Í":625,"Î":625,"Ï":625,"Ð":1501,"Ñ":1604,"Ò":1612,"Ó":1612,"Ô":1612,"Õ":1612,"Ö":1612,"×":1171,"Ø":1612,"Ù":1521,"Ú":1521,"Û":1521,"Ü":1521,"Ý":1212,"Þ":1259,"ß":1366,"à":1188,"á":1188,"â":1188,"ã":1188,"ä":1188,"å":1188,"æ":1822,"ç":1017,"è":1180,"é":1180,"ê":1180,"ë":1180,"ì":571,"í":571,"î":571,"ï":571,"ð":1248,"ñ":1301,"ò":1250,"ó":1250,"ô":1250,"õ":1250,"ö":1250,"÷":1171,"ø":1250,"ù":1301,"ú":1301,"û":1301,"ü":1301,"ý":1096,"þ":1275,"ÿ":1096,"•":770,"…":1672,"–":1024,"—":2048,"‘":396,"’":396,"“":813,"”":813},"underlinePosition":-100,"underlineThickness":50,"averageAdvanceUnits":1214};

/** `OPEN_SANS_METRICS.kerning[a + b] ?? 0` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * A baked character's own `hmtx` advance width, design units, or `null`
 * outside `advanceWidths` (the same charset as `OPEN_SANS_ATLAS_GLYPHS` —
 * `textLayout.ts`'s `glyphAdvancePx` falls back to `getAverageAdvancePx` in
 * that case, unchanged from before this table existed).
 *
 * This is the CONTINUOUS source `textLayout.ts` scales to a target pixel
 * size — never `openSansAtlas.ts`'s own `xadvance`, which is msdf-bmfont-xml's
 * OWN atlas-bake-resolution glyph table (bake size 42, INTEGER-rounded at
 * THAT resolution before this repo's bake script ever sees it) and therefore
 * carries roughly 1/2 an atlas-bake-pixel of quantization noise per glyph —
 * negligible at the atlas's own 42px bake size, but the SAME absolute error
 * persists after scaling down to a UI font size (16-18px), where it is a much
 * larger fraction of each glyph's own advance and accumulates roughly
 * linearly with line length. Godot's own real per-glyph advance
 * (`text_server_adv.cpp:7078`) is HarfBuzz's unrounded `x_advance` whenever
 * `subpos` is true — true for `SUBPIXEL_POSITIONING_AUTO` (Godot's own
 * default) at every font size this engine ships (`<=`
 * `SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE`, 20px, `servers/text/
 * text_server.h:172`) — itself FreeType's UNHINTED advance
 * (`thirdparty/harfbuzz/src/hb-ft.cc:115`'s default `FT_LOAD_NO_HINTING`), a
 * plain proportional scale of this SAME `hmtx` table with no rounding
 * anywhere in the chain. This getter is that same continuous scale.
 */
export function getGlyphAdvanceUnits(ch: string): number | null {
  return OPEN_SANS_METRICS.advanceWidths[ch] ?? null;
}

/**
 * `modules/text_server_adv/text_server_adv.cpp:1515-1516` — Godot's
 * TextServerAdvanced reads FreeType's PIXEL-QUANTIZED 26.6 fixed-point size
 * metrics (`face->size->metrics.ascender`), which rounds UP to a whole pixel.
 * Also `rich_text_label.cpp:1049`'s `off.y += l_ascent` (`l_ascent =
 * shaped_text_get_ascent`) — the SAME rounded value is where a line's
 * baseline sits, measured down from the line's own top; every other
 * baseline-relative pixel quantity (the italic shear's pivot, the underline
 * stroke's y) is this plus a further offset, never re-derived.
 *
 * At size 16: ceil(2189 * 16/2048) = 18.
 */
export function getAscentPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return Math.ceil(OPEN_SANS_METRICS.ascent * scale);
}

/**
 * Pixel line pitch at `fontSizePx`, replicating Godot's Label line-height
 * computation exactly rather than a raw float scale of the hhea table:
 *
 * - `modules/text_server_adv/text_server_adv.cpp:1515-1516` — ascent AND
 *   descent are each ceiling-rounded to a whole pixel INDEPENDENTLY before
 *   summing (not a raw float sum, THEN rounded once — that undershoots by
 *   ~1px system-wide, confirmed against real Godot pixels, packet P10 spike
 *   S2).
 * - `scene/theme/default_theme.cpp:392` — Label's `line_spacing` theme
 *   constant is `Math::round(3 * scale)`; `lineSpacingPx` defaults to 3 (UI
 *   scale 1.0).
 *
 * At size 16: 18 + ceil(600 * 16/2048) + 3 = 26.
 */
export function getLinePitchPx(fontSizePx: number, lineSpacingPx = 3): number {
  const ascentPx = getAscentPx(fontSizePx);
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  const descentPx = Math.ceil(OPEN_SANS_METRICS.descent * scale);
  return ascentPx + descentPx + lineSpacingPx;
}

/**
 * `text_server_adv.cpp:1517`: `fd->underline_position = (-FT_MulFix(face->underline_position,
 * size->metrics.y_scale) / 64.0) * fd->scale` — a plain proportional scale of
 * the `post` table value (NOT ceiling-rounded like ascent/descent; FreeType's
 * `y_scale` here is the raw 26.6 size scale, not a hinted metric), NEGATED so
 * a below-baseline `post` value (negative, that table's Y-up convention)
 * becomes a positive DOWNWARD pixel offset from the baseline —
 * `rich_text_label.cpp:1242-1244`'s `y_off = upos` is added directly to the
 * baseline y (`off_step.y`, itself `off.y` after `+= l_ascent`) with no
 * further sign flip.
 *
 * At size 16: -(-100) * 16/2048 = 0.78125.
 */
export function getUnderlinePositionPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return -OPEN_SANS_METRICS.underlinePosition * scale;
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

/**
 * Fallback advance for a character with no entry in `OPEN_SANS_ATLAS_GLYPHS`
 * (outside the baked charset) — this font's own OS/2 `xAvgCharWidth` scaled,
 * so a missing glyph still occupies roughly its own width rather than
 * collapsing the line to nothing (see `OPEN_SANS_ATLAS_GLYPHS`'s doc in the
 * atlas module and `textLayout.ts`'s `glyphAdvancePx`). This is a deliberate
 * approximation, not a Godot-measured value: real Godot would shape the
 * character against its own system-fallback fonts and draw real ink at that
 * character's real advance, which this renderer cannot do for a codepoint
 * outside the atlas.
 *
 * At size 16: 1214 * 16/2048 = 9.484375.
 */
export function getAverageAdvancePx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.averageAdvanceUnits * scale;
}
