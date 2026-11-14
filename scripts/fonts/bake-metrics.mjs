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
 * The kerning of pairs of characters, design units: none. The baked tables hold no pair to read, so
 * the bake fails for a font that kerns, and the face then needs a reader of its `GPOS` pairs.
 */
function bakeKerning(font) {
  const gposFeatures = font.GPOS?.featureList.map((feature) => feature.tag) ?? [];
  if (gposFeatures.includes('kern') || font.kern) {
    throw new Error(
      `expected a font with no kern feature and no kern table, got GPOS ${gposFeatures.join(' ')}`
    );
  }
  return {};
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
function bakeMetrics(font, kerning) {
  return {
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    descent: -font.descent, // fontkit reports descent negative; store the magnitude
    lineGap: font.lineGap,
    kerning,
    // Raw `post` table values, design units (fontkit's `src/TTFFont.js:189-201`),
    // which `openSansFontMetrics.ts` turns into FreeType's `face->underline_*`.
    underlinePosition: font.underlinePosition,
    underlineThickness: font.underlineThickness,
    // OS/2 `xAvgCharWidth`, design units: the font's typical glyph width, not a
    // magic constant. The advance of a character the font has no glyph for in
    // `fontMetrics.ts`'s `getFontGlyphAdvancePx`.
    averageAdvanceUnits: font['OS/2'].xAvgCharWidth,
  };
}

function renderMetricsModule(metrics) {
  return `${GENERATED_HEADER}
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
   * two-character pair (e.g. \`"AV"\`). Empty for OpenSans_SemiBold:
   * this font carries only \`mark\`/\`mkmk\` GPOS features, no
   * \`kern\` feature and no legacy \`kern\` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
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
   * value \`text_server_adv.cpp:1517\` then scales. \`openSansFontMetrics.ts\`
   * applies that conversion (\`freeTypeUnderlinePosition\`).
   */
  underlinePosition: number;
  /** \`post\` table \`underlineThickness\`, design units — FreeType publishes it unchanged (\`sfobjs.c:1426\`); scaled by \`text_server_adv.cpp:1518\`. */
  underlineThickness: number;
  /**
   * OS/2 \`xAvgCharWidth\`, design units — this font's own "typical glyph
   * width" metric, used ONLY as \`textLayout.ts\`'s fallback advance for a
   * character the font has no glyph for.
   */
  averageAdvanceUnits: number;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = ${JSON.stringify(metrics)};

/** \`OPEN_SANS_METRICS.kerning[a + b] ?? 0\` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
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
  const metrics = bakeMetrics(font, kerning);

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
