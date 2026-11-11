#!/usr/bin/env node
/**
 * Bakes the vendored OpenSans_SemiBold's metrics, shaping tables and bytes into the committed
 * `openSans{Metrics,Shaping,FontBytes}.ts` modules the native text engine reads:
 * `node scripts/fonts/bake-metrics.mjs [--check]`. `--check` diffs a fresh bake against them byte
 * for byte and exits 1 on a difference.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkitNs from 'fontkit';
import wawoff2 from 'wawoff2';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

const fontkit = fontkitNs.default ?? fontkitNs;

// The woff2 is Godot's own distributed `thirdparty/fonts/OpenSans_SemiBold.woff2`,
// the file `THIRD-PARTY-NOTICES.md` describes. `fontkit` does not decompress
// Brotli woff2, so `wawoff2` turns it into a TTF in memory. The TTF is never written.
const WOFF2_PATH = join(REPO_ROOT, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2');
const TEXT_DIR = join(REPO_ROOT, 'packages/textscene-core/src/r3f/controls/native/text');
const METRICS_OUT = join(TEXT_DIR, 'openSansMetrics.ts');
const FONT_BYTES_OUT = join(TEXT_DIR, 'openSansFontBytes.ts');
const SHAPING_OUT = join(TEXT_DIR, 'openSansShaping.ts');

// Full ASCII printable, 0x20 (space) to 0x7E (~), 95 glyphs. Do not narrow it.
const CHARSET_START = 0x20;
const CHARSET_END = 0x7e;

// Latin-1 Supplement, 0xA0 (NBSP) to 0xFF, for European accented letters.
// 0xAD (SOFT HYPHEN) is left out: an invisible Cf character that this font
// draws as a hyphen with GPOS kerning against almost every baked character,
// a visible-ink behaviour nothing here has measured against Godot.
const LATIN1_SUPPLEMENT_START = 0xa0;
const LATIN1_SUPPLEMENT_END = 0xff;
const LATIN1_SUPPLEMENT_EXCLUDE = new Set([0xad]);

// Punctuation outside both ranges, each baked for its own reason.
// The arrows U+2190 to U+2193 are not baked: Open Sans SemiBold has no glyph for them, and Godot
// draws them from a host font. A scene that needs them names a font that holds them.
const EXTRA_CODEPOINTS = [
  0x2022, // BULLET: LineEdit's default `secret_character` (`line_edit.cpp:3094`: `secret_character.is_empty() ? U"•" : ...`).
  0x2026, // HORIZONTAL ELLIPSIS: Label's default overrun character (`label.cpp:294`, also :299/:324/:328: `(el_char.length() > 0) ? el_char[0] : 0x2026`).
  0x2013, // EN DASH: common prose punctuation in scenes.
  0x2014, // EM DASH: common prose punctuation, used by the ScrollContainer fixture's Label.
  0x2018,
  0x2019, // Single curly quotes: common prose punctuation.
  0x201c,
  0x201d, // Double curly quotes: common prose punctuation.
  // The presentation forms of `ff`, `fi`, `fl`, `ffi` and `ffl`: text that holds one draws it at
  // its own advance.
  0xfb00,
  0xfb01,
  0xfb02,
  0xfb03,
  0xfb04,
];

const CHARSET = [];
for (let cp = CHARSET_START; cp <= CHARSET_END; cp++) CHARSET.push(String.fromCodePoint(cp));
for (let cp = LATIN1_SUPPLEMENT_START; cp <= LATIN1_SUPPLEMENT_END; cp++) {
  if (!LATIN1_SUPPLEMENT_EXCLUDE.has(cp)) CHARSET.push(String.fromCodePoint(cp));
}
for (const cp of EXTRA_CODEPOINTS) CHARSET.push(String.fromCodePoint(cp));

const GENERATED_HEADER = `// GENERATED FILE — do not hand-edit.
//
// Produced by \`scripts/fonts/bake-metrics.mjs\` from
// \`packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2\` (Godot
// 4.6.3's default theme font; upstream commit
// bd7e37632246368c60fdcbd374dbf9bad11969b6 — see THIRD-PARTY-NOTICES.md,
// licence OFL-1.1). Re-run the bake script to regenerate; its \`--check\` mode
// fails if this file has drifted from the vendored font.
`;

/** Runs `wawoff2.decompress` and `fontkit` against the vendored woff2. */
async function loadFont() {
  const woff2Buffer = readFileSync(WOFF2_PATH);
  const ttfBuffer = await wawoff2.decompress(woff2Buffer);
  const font = fontkit.create(Buffer.from(ttfBuffer));
  return { font, ttfBuffer: Buffer.from(ttfBuffer) };
}

/**
 * GPOS/kern pairwise advance adjustments over CHARSET x CHARSET, design units,
 * as HarfBuzz applies them in Godot's TextServerAdvanced. fontkit's `layout()`
 * exposes the same positioning for a 2-glyph run.
 */
function bakeKerning(font) {
  const kerning = {};
  for (const a of CHARSET) {
    const soloAdvance = font.glyphForCodePoint(a.codePointAt(0)).advanceWidth;
    for (const b of CHARSET) {
      const run = font.layout(a + b);
      if (run.glyphs.length !== 2) continue;
      const xAdvance = run.positions[0].xAdvance;
      const delta = xAdvance - soloAdvance;
      if (delta !== 0) kerning[a + b] = delta;
    }
  }
  // Sorted so the generated file is byte-stable across re-bakes.
  return Object.fromEntries(
    Object.keys(kerning)
      .sort()
      .map((k) => [k, kerning[k]])
  );
}

/**
 * Raw `hmtx` advance widths, design units, over `CHARSET`, which `fontMetrics.ts` quantizes at the
 * shaped size. Godot quantizes at the target size, so nothing here is pre-scaled or pre-rounded.
 */
// Godot's advance is HarfBuzz's `x_advance` (`text_server_adv.cpp:7077`), which
// `hb-ft.cc:523`'s `(v + (1<<9)) >> 10` rounds to 1/64 px after
// `ftadvanc.c:52`'s `FT_MulFix(1024 * advance, x_scale)` scales this table,
// FreeType's unhinted `hmtx` fast path (`hb-ft.cc:115`).
function bakeAdvanceWidths(font) {
  const advanceWidths = {};
  for (const ch of CHARSET) {
    advanceWidths[ch] = font.glyphForCodePoint(ch.codePointAt(0)).advanceWidth;
  }
  return advanceWidths;
}

/** The code points the `cmap` maps to a glyph, as ascending `[first, last]` ranges: what `_font_has_char` reads. */
function bakeCodePointRanges(font) {
  const ranges = [];
  const codePoints = font.characterSet.filter((cp) => font.hasGlyphForCodePoint(cp)).sort((a, b) => a - b);
  for (const cp of codePoints) {
    const last = ranges.at(-1);
    if (last && last[1] === cp - 1) last[1] = cp;
    else ranges.push([cp, cp]);
  }
  return ranges;
}

/** The bytes of the table `tag` in the TTF `ttfBuffer`, read from its table directory. */
function tableBytes(ttfBuffer, tag) {
  const numTables = ttfBuffer.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    if (ttfBuffer.toString('latin1', record, record + 4) !== tag) continue;
    const offset = ttfBuffer.readUInt32BE(record + 8);
    return ttfBuffer.subarray(offset, offset + ttfBuffer.readUInt32BE(record + 12));
  }
  throw new Error(`expected a ${tag} table in the vendored font, found none`);
}

/**
 * The tables the bundled face shapes a run with, as a scene font's face does (`sfntTables.ts`
 * `SCENE_FONT_TABLE_TAGS`): the `GSUB` of its ligatures, and the `cmap`, `GPOS`, `GDEF`
 * and metrics that place the marks of a character the font lacks.
 */
const SHAPING_TABLE_TAGS = ['head', 'hhea', 'maxp', 'cmap', 'hmtx', 'GDEF', 'GPOS', 'GSUB'];

// base64url, not base64: a `/` of base64 pairs with the next into what the literal-grammar guard
// reads as a regex literal (`godotLiteralGrammar.guard.test.ts`).
function bakeShaping(ttfBuffer) {
  return Object.fromEntries(
    SHAPING_TABLE_TAGS.map((tag) => [tag, tableBytes(ttfBuffer, tag).toString('base64url')])
  );
}

/** Font-wide scalar metrics, design units (`font.unitsPerEm`-relative). */
function bakeMetrics(font, kerning, advanceWidths) {
  return {
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    descent: -font.descent, // fontkit reports descent negative; store the magnitude
    lineGap: font.lineGap,
    kerning,
    advanceWidths,
    // Raw `post` table values, design units (fontkit's `src/TTFFont.js:189-201`),
    // which FreeType exposes as `face->underline_*` and
    // `text_server_adv.cpp:1517-1518` scales (`getUnderlinePositionPx` and
    // `getUnderlineThicknessPx` below).
    underlinePosition: font.underlinePosition,
    underlineThickness: font.underlineThickness,
    // OS/2 `xAvgCharWidth`, design units: the font's typical glyph width, not a
    // magic constant. The fallback advance outside the baked charset in
    // `fontMetrics.ts`'s `getFontGlyphAdvancePx`.
    averageAdvanceUnits: font['OS/2'].xAvgCharWidth,
    codePointRanges: bakeCodePointRanges(font),
  };
}

function renderMetricsModule(metrics) {
  return `${GENERATED_HEADER}
import { firstEndAtOrAbove } from '../../../../utils/firstEndAtOrAbove';

/**
 * Font-wide scalar metrics for OpenSans_SemiBold, in font design units
 * (\`unitsPerEm\` = ${metrics.unitsPerEm}), read via \`fontkit\` from the vendored
 * \`.woff2\` (decompressed in memory at bake time with \`wawoff2\`, since
 * fontkit does not decompress woff2 itself — see the bake script's header).
 */
interface OpenSansMetrics {
  /** \`font.unitsPerEm\` (fontkit) — hhea/head design units per em. */
  unitsPerEm: number;
  /** hhea ascender, design units (positive, upward). */
  ascent: number;
  /** hhea descender MAGNITUDE, design units (fontkit reports it negative; stored positive here). */
  descent: number;
  /** hhea lineGap, design units. */
  lineGap: number;
  /**
   * GPOS/kern pairwise advance adjustment, design units, keyed by the
   * two-character pair (e.g. \`"AV"\`). Empty for OpenSans_SemiBold's baked
   * charset product — this font carries only \`mark\`/\`mkmk\` GPOS features, no
   * \`kern\` feature and no legacy \`kern\` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
  /**
   * Per-glyph \`hmtx\` advance width, design units, keyed by character over the
   * bake script's \`CHARSET\`, read through \`fontkit\`'s \`Glyph#advanceWidth\`.
   * \`getGlyphAdvanceUnits\` is the only intended reader.
   */
  advanceWidths: Record<string, number>;
  /**
   * \`post\` table \`underlinePosition\`, design units — the TOP EDGE of the
   * underline stroke relative to the baseline, POSITIVE = above baseline (the
   * \`post\` table's own Y-up convention; typically negative for a
   * below-baseline underline). Read via \`fontkit\`'s
   * \`TTFFont#underlinePosition\` (\`fontkit/src/TTFFont.js:192-194\`, itself
   * \`post.underlinePosition\`).
   *
   * This is the RAW table value, NOT FreeType's \`face->underline_position\`:
   * FreeType re-bases it from that top edge onto the stroke's CENTRE before
   * publishing it (\`freetype/src/sfnt/sfobjs.c:1424-1425\`), which is the
   * value \`text_server_adv.cpp:1517\` then scales. \`getUnderlinePositionPx\`
   * applies that conversion; nothing should read this field without it.
   */
  underlinePosition: number;
  /** \`post\` table \`underlineThickness\`, design units — FreeType publishes it unchanged (\`sfobjs.c:1426\`); scaled by \`text_server_adv.cpp:1518\`. */
  underlineThickness: number;
  /**
   * OS/2 \`xAvgCharWidth\`, design units — this font's own "typical glyph
   * width" metric, used ONLY as \`textLayout.ts\`'s fallback advance for a
   * character outside \`advanceWidths\`.
   */
  averageAdvanceUnits: number;
  /** The code points the whole font maps to a glyph, as ascending \`[first, last]\` ranges, beyond the baked charset. */
  codePointRanges: [number, number][];
}

export const OPEN_SANS_METRICS: OpenSansMetrics = ${JSON.stringify(metrics)};

/** \`OPEN_SANS_METRICS.kerning[a + b] ?? 0\` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * A baked character's own \`hmtx\` advance width, design units, or \`null\`
 * outside \`advanceWidths\` (\`fontMetrics.ts\`'s \`getFontGlyphAdvancePx\` falls
 * back to \`averageAdvanceUnits\` in that case).
 *
 * This is the RAW design-unit value, at no size and quantized by nothing.
 * Godot's own per-glyph advance is quantized at the TARGET size:
 * \`text_server_adv.cpp:7077\` reads HarfBuzz's
 * \`x_advance\`, which \`thirdparty/harfbuzz/src/hb-ft.cc:523\` has already
 * rounded to a whole number of 1/64 px (26.6) after
 * \`thirdparty/freetype/src/base/ftadvanc.c:52\` scaled THIS table's raw value
 * by FreeType's \`x_scale\`; and above
 * \`SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE\` (20px, \`servers/text/
 * text_server.h:172\`) \`text_server_adv.cpp:7080\` rounds it again, to a
 * whole pixel. Neither rounding can be baked into this table — both depend
 * on the size the text is shaped at — so both live in
 * \`fontMetrics.ts\`/\`textLayout.ts\`, and this getter stays raw.
 */
export function getGlyphAdvanceUnits(ch: string): number | null {
  return OPEN_SANS_METRICS.advanceWidths[ch] ?? null;
}

/** Whether the whole font, not only the baked charset, has a glyph for \`ch\`: Godot's default font draws it. */
export function hasGlyph(ch: string): boolean {
  const codePoint = ch.codePointAt(0)!;
  const ranges = OPEN_SANS_METRICS.codePointRanges;
  const i = firstEndAtOrAbove(ranges.length, (k) => ranges[k]![1], codePoint);
  return i < ranges.length && ranges[i]![0] <= codePoint;
}

/**
 * Downward pixel offset from a line's baseline to the CENTRE of its underline
 * stroke — Godot's \`shaped_text_get_underline_position\`, which a stroke
 * drawer (\`rich_text_label.cpp:1242-1244\`'s \`y_off = upos\`) adds straight
 * onto the baseline y with no further sign flip.
 *
 * Two conversions sit between the \`post\` table and that number, and dropping
 * either moves the rule a whole pixel row at UI sizes:
 *
 * 1. \`freetype/src/sfnt/sfobjs.c:1424-1425\` — FreeType re-bases the table's
 *    TOP-EDGE convention onto the stroke's centre before publishing
 *    \`face->underline_position\`:
 *    \`post.underlinePosition - post.underlineThickness / 2\`, an integer
 *    division on \`FT_Short\`. Half a stroke is only a fraction of a pixel at
 *    a UI size, but the rule is snapped to whole rows downstream, so it is
 *    the fraction that decides which row.
 * 2. \`text_server_adv.cpp:1517\` — \`(-FT_MulFix(face->underline_position,
 *    size->metrics.y_scale) / 64.0) * fd->scale\`, a plain proportional scale
 *    (NOT ceiling-rounded like ascent/descent), NEGATED so a below-baseline
 *    (negative) table value becomes a positive DOWNWARD offset.
 *
 * FreeType's own scale quantizes to 26.6 fixed point, which this does not
 * reproduce — the same approximation \`getFontAscentPx\` already makes, and
 * bounded by 1/64 px (0.016), well under the half-pixel that would move a
 * snapped row at any size.
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
 * \`text_server_adv.cpp:1518\`, scaled the same way as \`getUnderlinePositionPx\`
 * (no negation — a thickness has no sign to flip). The MINIMUM 1px stroke
 * width (\`rich_text_label.cpp:1243\`: \`MAX(1.0, uth * theme_cache.base_scale)\`)
 * is the CALLER's job, not baked in here — \`base_scale\` is a UI content-scale
 * factor this renderer does not thread through text metrics, and every fixture
 * renders at its default (1.0), where the max is a no-op
 * unless the font's own thickness already exceeds 1px.
 *
 * At size 16: 50 * 16/2048 = 0.390625.
 */
export function getUnderlineThicknessPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.underlineThickness * scale;
}
`;
}

function renderShapingModule(tables) {
  return `${GENERATED_HEADER}
// The tables below are generated data on long lines. The bundled face shapes each run through them
// (\`openSansFontMetrics.ts\`), as Godot's HarfBuzz shapes the font.

/** The font's shaping tables, base64url with no padding, by tag. */
export const OPEN_SANS_SHAPING_TABLES: Readonly<Record<string, string>> = ${JSON.stringify(tables, null, 2)};
`;
}

function renderFontBytesModule(woff2Buffer) {
  return `${GENERATED_HEADER}
// The base64 payload below is generated data on one very long line.

/**
 * The vendored woff2's own bytes, base64. Inline, not fetched: the VS Code webview CSP is
 * \`default-src 'none'\` with no \`connect-src\`, so a fetch of the font is blocked.
 *
 * Shaping never reads this: the baked tables of \`openSansMetrics.ts\` and \`openSansShaping.ts\`
 * do. The outline reader decodes these bytes for the glyphs a run draws (\`sceneFontOutlines.ts\`).
 */
export const OPEN_SANS_WOFF2_BASE64 = ${JSON.stringify(woff2Buffer.toString('base64'))};
`;
}

async function bake() {
  const { font, ttfBuffer } = await loadFont();
  const kerning = bakeKerning(font);
  const advanceWidths = bakeAdvanceWidths(font);
  const metrics = bakeMetrics(font, kerning, advanceWidths);

  return {
    metricsSource: renderMetricsModule(metrics),
    fontBytesSource: renderFontBytesModule(readFileSync(WOFF2_PATH)),
    shapingSource: renderShapingModule(bakeShaping(ttfBuffer)),
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const { metricsSource, fontBytesSource, shapingSource } = await bake();
  const outputs = [
    [METRICS_OUT, metricsSource],
    [FONT_BYTES_OUT, fontBytesSource],
    [SHAPING_OUT, shapingSource],
  ];

  if (check) checkGenerated(outputs, { tool: 'bake-metrics', command: 'pnpm fonts:bake' });
  else writeGenerated(outputs, { tool: 'bake-metrics' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
