#!/usr/bin/env node
/**
 * Bakes the vendored OpenSans_SemiBold's metrics, MSDF atlas and bytes into the
 * committed `openSans{Metrics,Atlas,FontBytes}.ts` modules the native Control
 * text painter reads: `node scripts/fonts/bake-metrics.mjs [--check]`. `--check`
 * diffs a fresh bake against them byte for byte and exits 1 on a difference.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import generateBMFont from 'msdf-bmfont-xml';
import * as fontkitNs from 'fontkit';
import wawoff2 from 'wawoff2';

const fontkit = fontkitNs.default ?? fontkitNs;

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');

// The woff2 is Godot's own distributed `thirdparty/fonts/OpenSans_SemiBold.woff2`,
// the file `THIRD-PARTY-NOTICES.md` describes. Neither `fontkit` nor
// `msdf-bmfont-xml` decompresses Brotli woff2, so `wawoff2` turns it into a TTF
// in memory. The TTF is never written.
const WOFF2_PATH = join(REPO_ROOT, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2');
const TEXT_DIR = join(REPO_ROOT, 'packages/textscene-core/src/r3f/controls/native/text');
const METRICS_OUT = join(TEXT_DIR, 'openSansMetrics.ts');
const ATLAS_OUT = join(TEXT_DIR, 'openSansAtlas.ts');
const FONT_BYTES_OUT = join(TEXT_DIR, 'openSansFontBytes.ts');

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
const EXTRA_CODEPOINTS = [
  0x2022, // BULLET: LineEdit's default `secret_character` (`line_edit.cpp:3094`: `secret_character.is_empty() ? U"•" : ...`).
  0x2026, // HORIZONTAL ELLIPSIS: Label's default overrun character (`label.cpp:294`, also :299/:324/:328: `(el_char.length() > 0) ? el_char[0] : 0x2026`).
  0x2013, // EN DASH: common prose punctuation in scenes.
  0x2014, // EM DASH: common prose punctuation, used by the ScrollContainer fixture's Label.
  0x2018,
  0x2019, // Single curly quotes: common prose punctuation.
  0x201c,
  0x201d, // Double curly quotes: common prose punctuation.
];

const CHARSET = [];
for (let cp = CHARSET_START; cp <= CHARSET_END; cp++) CHARSET.push(String.fromCodePoint(cp));
for (let cp = LATIN1_SUPPLEMENT_START; cp <= LATIN1_SUPPLEMENT_END; cp++) {
  if (!LATIN1_SUPPLEMENT_EXCLUDE.has(cp)) CHARSET.push(String.fromCodePoint(cp));
}
for (const cp of EXTRA_CODEPOINTS) CHARSET.push(String.fromCodePoint(cp));

// A pre-baked atlas, not a runtime font such as troika-three-text: the webview
// CSP has no `worker-src blob:` or `connect-src`, and grants `img-src ... data:`.
// Baked above any Godot theme default size (16), so glyph edges keep MSDF
// resolution when magnified for headings.
const ATLAS_FONT_SIZE = 42;
const ATLAS_DISTANCE_RANGE = 4;
const ATLAS_TEXTURE_SIZE = [512, 512]; // smartSize below shrinks to the tightest fit

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
  return Object.fromEntries(Object.keys(kerning).sort().map((k) => [k, kerning[k]]));
}

/**
 * Raw `hmtx` advance widths, design units, over `CHARSET`: the source
 * `fontMetrics.ts` quantizes at the shaped size, not the atlas's `xadvance`,
 * which msdf-bmfont-xml's `index.js:400` fixes at bake size 42. Godot quantizes
 * at the target size, so nothing here is pre-scaled or pre-rounded.
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
    // `textLayout.ts`'s `glyphAdvancePx`.
    averageAdvanceUnits: font['OS/2'].xAvgCharWidth,
  };
}

/** Runs msdf-bmfont-xml against the in-memory TTF buffer. Returns { png, glyphsByChar, atlasInfo }. */
function bakeAtlas(ttfBuffer) {
  const quietLogger = { log() {}, warn() {}, error() {} };
  return new Promise((resolve, reject) => {
    generateBMFont(
      ttfBuffer,
      {
        filename: 'OpenSans_SemiBold',
        fontSize: ATLAS_FONT_SIZE,
        charset: CHARSET,
        textureSize: ATLAS_TEXTURE_SIZE,
        smartSize: true,
        distanceRange: ATLAS_DISTANCE_RANGE,
        fieldType: 'msdf',
        outputType: 'json',
        // Explicit `null`, not omitted: `index.js:111`'s `valueQueue` returns the
        // first value `!== undefined`, so `null` reaches `index.js:298` and turns
        // off the round of `base`, `lineHeight`, `xadvance` and `yoffset` to whole
        // bake-pixels. Not a decimal count, a second rounding Godot does not do.
        roundDecimal: null,
      },
      (err, textures, font) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        // This runs in the library's callback, not the executor, so a `throw`
        // would escape unhandled instead of rejecting the promise.
        try {
          const data = JSON.parse(font.data);
          const glyphsByChar = {};
          for (const ch of CHARSET) {
            const glyph = data.chars.find((c) => c.char === ch);
            if (!glyph) throw new Error(`msdf-bmfont-xml produced no glyph entry for ${JSON.stringify(ch)}`);
            glyphsByChar[ch] = {
              width: glyph.width,
              height: glyph.height,
              xoffset: glyph.xoffset,
              yoffset: glyph.yoffset,
              xadvance: glyph.xadvance,
              x: glyph.x,
              y: glyph.y,
            };
          }
          const atlasInfo = {
            fontSize: data.info.size,
            distanceRange: data.distanceField.distanceRange,
            scaleW: data.common.scaleW,
            scaleH: data.common.scaleH,
            lineHeight: data.common.lineHeight,
            base: data.common.base,
          };
          resolve({ png: textures[0].texture, glyphsByChar, atlasInfo });
        } catch (parseErr) {
          reject(parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
        }
      },
      quietLogger
    );
  });
}

function renderMetricsModule(metrics) {
  return `${GENERATED_HEADER}
import { getFontAscentPx, getFontLinePitchPx } from './fontMetrics';

/**
 * Font-wide scalar metrics for OpenSans_SemiBold, in font design units
 * (\`unitsPerEm\` = ${metrics.unitsPerEm}), read via \`fontkit\` from the vendored
 * \`.woff2\` (decompressed in memory at bake time with \`wawoff2\`, since
 * fontkit does not decompress woff2 itself — see the bake script's header).
 *
 * \`advanceWidths\` IS a deliberate duplicate of \`openSansAtlas.ts\`'s own
 * glyph table's \`xadvance\` field — the ONE exception to "one bake, one
 * source": that table is the atlas tool's OWN glyph geometry (bitmap
 * placement inside the PNG, at the atlas's bake-size-42 resolution) —
 * \`xadvance\` is \`glyph.advanceWidth * (fontSize / unitsPerEm)\` FIXED to
 * that bake size (msdf-bmfont-xml's \`index.js:400\`), where THIS one is the
 * RAW \`hmtx\` value, quantized by nothing and at no size — see
 * \`getGlyphAdvanceUnits\`'s own doc for why a shaper never wants the ATLAS's
 * copy.
 */
export interface OpenSansMetrics {
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
   * Per-glyph \`hmtx\` advance width, design units, keyed by character — the
   * SAME \`CHARSET\` \`openSansAtlas.ts\` bakes, read directly via \`fontkit\`'s
   * \`Glyph#advanceWidth\` (\`bake-metrics.mjs\`'s own \`bakeAdvanceWidths\`
   * doc has the full citation for why this is the correct source and
   * \`openSansAtlas.ts\`'s \`xadvance\` is not). \`getGlyphAdvanceUnits\` is the
   * only intended reader.
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
   * character outside \`OPEN_SANS_ATLAS_GLYPHS\`/\`advanceWidths\` (see that
   * table's own doc in the atlas module).
   */
  averageAdvanceUnits: number;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = ${JSON.stringify(metrics)};

/** \`OPEN_SANS_METRICS.kerning[a + b] ?? 0\` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * A baked character's own \`hmtx\` advance width, design units, or \`null\`
 * outside \`advanceWidths\` (the same charset as \`OPEN_SANS_ATLAS_GLYPHS\` —
 * \`textLayout.ts\`'s \`glyphAdvancePx\` falls back to \`getAverageAdvancePx\` in
 * that case, unchanged from before this table existed).
 *
 * This is the RAW design-unit value, at no size and quantized by nothing —
 * never \`openSansAtlas.ts\`'s own \`xadvance\`, which is msdf-bmfont-xml's OWN
 * atlas-bake-resolution glyph table, fixed to bake size 42
 * (\`glyph.advanceWidth * (fontSize / unitsPerEm)\`, msdf-bmfont-xml's
 * \`index.js:400\`) before this repo's bake script ever reads it back. Scaling
 * that bake-size-42 value down to a UI font size (14-28px) does not reproduce
 * HarfBuzz's own target-size shaping, and the error accumulates roughly
 * linearly with line length.
 *
 * Godot's own per-glyph advance is quantized too, just at the TARGET size
 * rather than the atlas's: \`text_server_adv.cpp:7077\` reads HarfBuzz's
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

/**
 * \`modules/text_server_adv/text_server_adv.cpp:1515-1516\` — Godot's
 * TextServerAdvanced reads FreeType's PIXEL-QUANTIZED 26.6 fixed-point size
 * metrics (\`face->size->metrics.ascender\`), which rounds UP to a whole pixel.
 * Also \`rich_text_label.cpp:1049\`'s \`off.y += l_ascent\` (\`l_ascent =
 * shaped_text_get_ascent\`) — the SAME rounded value is where a line's
 * baseline sits, measured down from the line's own top; every other
 * baseline-relative pixel quantity (the italic shear's pivot, the underline
 * stroke's y) is this plus a further offset, never re-derived.
 *
 * At size 16: ceil(${metrics.ascent} * 16/${metrics.unitsPerEm}) = 18.
 *
 * Delegates to \`fontMetrics.ts\`'s \`getFontAscentPx\` — the SAME pixel-
 * quantization rule any other \`FontMetrics\` implementation goes through, so
 * this generated convenience function can never drift from it.
 */
export function getAscentPx(fontSizePx: number): number {
  return getFontAscentPx(OPEN_SANS_METRICS, fontSizePx);
}

/**
 * Pixel line pitch at \`fontSizePx\`, replicating Godot's Label line-height
 * computation exactly rather than a raw float scale of the hhea table:
 *
 * - \`modules/text_server_adv/text_server_adv.cpp:1515-1516\` — ascent AND
 *   descent are each ceiling-rounded to a whole pixel INDEPENDENTLY before
 *   summing (not a raw float sum, THEN rounded once — that undershoots by
 *   ~1px system-wide, confirmed against real Godot pixels).
 * - \`scene/theme/default_theme.cpp:392\` — Label's \`line_spacing\` theme
 *   constant is \`Math::round(3 * scale)\`; \`lineSpacingPx\` defaults to 3 (UI
 *   scale 1.0).
 *
 * At size 16: ${Math.ceil((metrics.ascent * 16) / metrics.unitsPerEm)} + ceil(${metrics.descent} * 16/${metrics.unitsPerEm}) + 3 = 26.
 *
 * Delegates to \`fontMetrics.ts\`'s \`getFontLinePitchPx\` — see that
 * function's own doc for why the independent-ceiling-then-sum rule above
 * lives there, once, rather than here.
 */
export function getLinePitchPx(fontSizePx: number, lineSpacingPx = 3): number {
  return getFontLinePitchPx(OPEN_SANS_METRICS, fontSizePx, lineSpacingPx);
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
 * \`text_server_adv.cpp:1518\`, scaled the same way as \`getUnderlinePositionPx\`
 * (no negation — a thickness has no sign to flip). The MINIMUM 1px stroke
 * width (\`rich_text_label.cpp:1243\`: \`MAX(1.0, uth * theme_cache.base_scale)\`)
 * is the CALLER's job, not baked in here — \`base_scale\` is a UI content-scale
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
 * Fallback advance for a character with no entry in \`OPEN_SANS_ATLAS_GLYPHS\`
 * (outside the baked charset) — this font's own OS/2 \`xAvgCharWidth\` scaled,
 * so a missing glyph still occupies roughly its own width rather than
 * collapsing the line to nothing (see \`OPEN_SANS_ATLAS_GLYPHS\`'s doc in the
 * atlas module and \`textLayout.ts\`'s \`glyphAdvancePx\`). This is a deliberate
 * approximation, not a Godot-measured value: real Godot would shape the
 * character against its own system-fallback fonts and draw real ink at that
 * character's real advance, which this renderer cannot do for a codepoint
 * outside the atlas.
 *
 * At size 16: ${metrics.averageAdvanceUnits} * 16/${metrics.unitsPerEm} = ${(metrics.averageAdvanceUnits * 16) / metrics.unitsPerEm}.
 */
export function getAverageAdvancePx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.averageAdvanceUnits * scale;
}
`;
}

function renderAtlasModule({ pngDataUrl, glyphsByChar, atlasInfo }) {
  return `${GENERATED_HEADER}
// The glyph table and atlas image below are generated data (base64 + a
// per-glyph JSON table for CHARSET.length glyphs) on single very long lines;
// this file is excluded from lint entirely via eslint.config.js's ignore list.

/** One glyph's MSDF-atlas placement/geometry, in atlas-bake-size pixels (see \`OPEN_SANS_ATLAS_INFO.fontSize\`). */
export interface OpenSansGlyph {
  /** Glyph bitmap width in the atlas, atlas-bake-size px. 0 for whitespace (msdf-bmfont-xml emits no bitmap for it). */
  width: number;
  /** Glyph bitmap height in the atlas, atlas-bake-size px. */
  height: number;
  /** Offset from the pen position to the bitmap's left edge, atlas-bake-size px. */
  xoffset: number;
  /** Offset from the line-top to the bitmap's top edge, atlas-bake-size px. */
  yoffset: number;
  /**
   * msdf-bmfont-xml's OWN glyph-table advance, fixed to atlas-bake-size (42)
   * px (\`glyph.advanceWidth * (fontSize / unitsPerEm)\`, msdf-bmfont-xml's
   * \`index.js:400\`) — NOT the glyph shaper's advance source:
   * \`openSansMetrics.ts\`'s \`getGlyphAdvanceUnits\` (this SAME \`hmtx\` table,
   * raw and at no size, quantized by \`fontMetrics.ts\` at the size actually
   * shaped) is — see that function's own doc for why a value fixed to the
   * atlas's bake size is the wrong source for a shaper targeting a different
   * size. Kept only as atlas metadata a consumer might reasonably expect a
   * glyph-info table to carry; \`textLayout.ts\` never reads this field.
   */
  xadvance: number;
  /** Left edge of the glyph's bitmap within the atlas texture, px. */
  x: number;
  /** Top edge of the glyph's bitmap within the atlas texture, px. */
  y: number;
}

export interface OpenSansAtlasInfo {
  /** Font size (px) the atlas was baked at. Scale render text by (targetSizePx / fontSize). */
  fontSize: number;
  /** MSDF distance field range, atlas-bake-size px (msdfgen \`-r\`). */
  distanceRange: number;
  /** Atlas texture width, px. */
  scaleW: number;
  /** Atlas texture height, px. */
  scaleH: number;
  /** BMFont \`common.lineHeight\`, atlas-bake-size px. */
  lineHeight: number;
  /** BMFont \`common.base\` (baseline offset from the atlas cell's top), atlas-bake-size px. */
  base: number;
}

export const OPEN_SANS_ATLAS_INFO: OpenSansAtlasInfo = ${JSON.stringify(atlasInfo)};

/**
 * Keyed by character — ASCII printable 0x20-0x7E, Latin-1 Supplement 0xA0-0xFF,
 * and a handful of individual punctuation codepoints (bullet, ellipsis, en/em
 * dash, curly quotes) the bake script's own \`CHARSET\`/\`EXTRA_CODEPOINTS\`
 * build; see that script for what each addition is for and do not narrow
 * either range without checking its callers first.
 *
 * A codepoint OUTSIDE this table draws no ink (\`openSansAtlas\`-backed
 * painters skip a glyph placement with no atlas entry) but is NOT silently
 * zero-width: \`text/textLayout.ts\`'s \`glyphAdvancePx\` falls back to this
 * font's own OS/2 \`xAvgCharWidth\` (\`OPEN_SANS_METRICS.averageAdvanceUnits\`,
 * scaled) rather than 0, so an unbaked character still occupies roughly its
 * own width instead of collapsing the line around it.
 */
export const OPEN_SANS_ATLAS_GLYPHS: Record<string, OpenSansGlyph> = ${JSON.stringify(glyphsByChar)};

/** MSDF atlas texture (\`distanceField.fieldType: "msdf"\`), inline so it rides \`img-src ... data:\` under the VS Code webview CSP (ADR-0003). */
export const OPEN_SANS_ATLAS_PNG_DATA_URL = ${JSON.stringify(pngDataUrl)};
`;
}

function renderFontBytesModule(woff2Buffer) {
  return `${GENERATED_HEADER}
// The base64 payload below is generated data on one very long line. Unlike
// \`openSansAtlas.ts\` this file needs no eslint ignore entry — it is one
// string export and lints clean.

/**
 * The vendored woff2's own bytes, base64. INLINE rather than fetched: the VS
 * Code webview CSP is \`default-src 'none'\` with no \`connect-src\`/\`font-src\`,
 * so the only validated door is \`new FontFace(name, arrayBuffer)\` +
 * \`document.fonts.add\` (\`sceneFontLoader.ts\`'s own doc) — a \`data:\` URL would
 * still be a blocked FETCH.
 *
 * Shaping never reads this: \`openSansMetrics.ts\`'s baked design-unit tables
 * do. These bytes exist so a canvas-2D painter can RASTERISE the same font
 * (\`openSansCanvasFontMetrics.ts\`).
 */
export const OPEN_SANS_WOFF2_BASE64 = ${JSON.stringify(woff2Buffer.toString('base64'))};
`;
}

async function bake() {
  const { font, ttfBuffer } = await loadFont();
  const kerning = bakeKerning(font);
  const advanceWidths = bakeAdvanceWidths(font);
  const metrics = bakeMetrics(font, kerning, advanceWidths);
  const { png, glyphsByChar, atlasInfo } = await bakeAtlas(ttfBuffer);
  const pngDataUrl = `data:image/png;base64,${png.toString('base64')}`;

  return {
    metricsSource: renderMetricsModule(metrics),
    atlasSource: renderAtlasModule({ pngDataUrl, glyphsByChar, atlasInfo }),
    fontBytesSource: renderFontBytesModule(readFileSync(WOFF2_PATH)),
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const { metricsSource, atlasSource, fontBytesSource } = await bake();

  if (check) {
    let stale = false;
    for (const [path, expected] of [
      [METRICS_OUT, metricsSource],
      [ATLAS_OUT, atlasSource],
      [FONT_BYTES_OUT, fontBytesSource],
    ]) {
      let actual;
      try {
        actual = readFileSync(path, 'utf8');
      } catch {
        actual = null;
      }
      if (actual !== expected) {
        stale = true;
        console.error(`[bake-metrics] STALE: ${path} does not match a fresh bake of the vendored font.`);
        if (actual !== null) {
          const actualLines = actual.split('\n');
          const expectedLines = expected.split('\n');
          const firstDiff = actualLines.findIndex((line, i) => line !== expectedLines[i]);
          console.error(`[bake-metrics]   first differing line: ${firstDiff === -1 ? '(length differs)' : firstDiff + 1}`);
        }
      }
    }
    if (stale) {
      console.error('[bake-metrics] run `node scripts/fonts/bake-metrics.mjs` (no --check) to regenerate, then commit.');
      process.exit(1);
    }
    console.log('[bake-metrics] OK: committed artifacts match a fresh bake of the vendored font.');
    return;
  }

  writeFileSync(METRICS_OUT, metricsSource);
  writeFileSync(ATLAS_OUT, atlasSource);
  writeFileSync(FONT_BYTES_OUT, fontBytesSource);
  console.log(`[bake-metrics] wrote ${METRICS_OUT}`);
  console.log(`[bake-metrics] wrote ${ATLAS_OUT}`);
  console.log(`[bake-metrics] wrote ${FONT_BYTES_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
