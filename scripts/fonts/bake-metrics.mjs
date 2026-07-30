#!/usr/bin/env node
/**
 * Bakes the OpenSans_SemiBold font metrics + MSDF glyph atlas that the native
 * (WebGL) Control text painter reads, from the vendored font, into two
 * COMMITTED TypeScript modules:
 *
 *   packages/textscene-core/src/r3f/controls/native/text/openSansMetrics.ts
 *   packages/textscene-core/src/r3f/controls/native/text/openSansAtlas.ts
 *
 * ## Why a pre-baked MSDF atlas, not a runtime font
 *
 * Spike S1 (packet P10) found the obvious alternative — troika-three-text /
 * drei's `<Text>`, which parses a real font at runtime — is blocked TWICE
 * over by the VS Code webview CSP: its SDF-generation worker needs
 * `worker-src blob:` and its font fetch needs `connect-src`, and this CSP has
 * neither (both fall back to `default-src 'none'`). A pre-baked MSDF atlas
 * PNG works because it rides `img-src ... data:`, which the CSP explicitly
 * grants — see `<scratchpad>/s1-font-csp/FINDINGS.md` from that spike.
 *
 * ## Why vendor the woff2 (not the TTF) as the checked-in font asset
 *
 * Godot ships `thirdparty/fonts/OpenSans_SemiBold.woff2` — that IS upstream's
 * distributed artifact (smaller than a TTF, and it's what
 * `THIRD-PARTY-NOTICES.md`'s licence entry describes). Neither `fontkit`
 * (metrics) nor `msdf-bmfont-xml` (atlas, via its bundled `opentype.js`)
 * decompresses real Brotli woff2 itself, so this script decompresses it to a
 * TTF IN MEMORY at bake time with `wawoff2` (Google's `woff2` build via
 * WebAssembly) before handing that buffer to either tool. Nothing but this
 * script ever needs the TTF form — it is not written to disk, and it is not
 * a committed artifact. The two generated `.ts` modules below (plus the
 * vendored `.woff2`) are the only things production ever loads.
 *
 * ## `--check`
 *
 * Re-runs the exact same bake and diffs the result, byte for byte, against
 * the committed files — so the committed artifacts can never silently drift
 * from the vendored font. Exits 1 (with a message naming which file and
 * where) if anything differs; exits 0 if they match.
 *
 *   node scripts/fonts/bake-metrics.mjs           # writes the committed files
 *   node scripts/fonts/bake-metrics.mjs --check   # verifies, writes nothing
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

const WOFF2_PATH = join(REPO_ROOT, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2');
const TEXT_DIR = join(REPO_ROOT, 'packages/textscene-core/src/r3f/controls/native/text');
const METRICS_OUT = join(TEXT_DIR, 'openSansMetrics.ts');
const ATLAS_OUT = join(TEXT_DIR, 'openSansAtlas.ts');

// Full ASCII printable, 0x20 (space) .. 0x7E (~) — 95 glyphs. Decided in
// packet P10; do not narrow it.
const CHARSET_START = 0x20;
const CHARSET_END = 0x7e;
const CHARSET = [];
for (let cp = CHARSET_START; cp <= CHARSET_END; cp++) CHARSET.push(String.fromCharCode(cp));

// The atlas is baked at a larger font size than any Godot theme default (16)
// so glyph edges keep enough MSDF resolution when magnified for headings —
// spike S2's own asset-budget measurement used the same values.
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
 * GPOS/kern pairwise advance adjustments over the full ASCII x ASCII
 * product, design units. A real shaper (HarfBuzz, which Godot's
 * TextServerAdvanced uses) applies exactly this kind of pairwise adjustment
 * for GPOS kerning pairs; fontkit's `layout()` exposes the same positioning
 * data for a 2-glyph run.
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

/** Font-wide scalar metrics, design units (`font.unitsPerEm`-relative). */
function bakeMetrics(font, kerning) {
  return {
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    descent: -font.descent, // fontkit reports descent negative; store the magnitude
    lineGap: font.lineGap,
    kerning,
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
      },
      (err, textures, font) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
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
      },
      quietLogger
    );
  });
}

function renderMetricsModule(metrics) {
  return `${GENERATED_HEADER}
/**
 * Font-wide scalar metrics for OpenSans_SemiBold, in font design units
 * (\`unitsPerEm\` = ${metrics.unitsPerEm}), read via \`fontkit\` from the vendored
 * \`.woff2\` (decompressed in memory at bake time with \`wawoff2\`, since
 * fontkit does not decompress woff2 itself — see the bake script's header).
 *
 * Per-glyph advances are deliberately NOT duplicated here: \`openSansAtlas.ts\`'s
 * glyph table already carries \`xadvance\` from the same \`hmtx\` source, and a
 * second copy would just be a second place for the two to drift apart.
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
   * two-character pair (e.g. \`"AV"\`). Empty for OpenSans_SemiBold's ASCII x
   * ASCII product — this font carries only \`mark\`/\`mkmk\` GPOS features, no
   * \`kern\` feature and no legacy \`kern\` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = ${JSON.stringify(metrics)};

/** \`OPEN_SANS_METRICS.kerning[a + b] ?? 0\` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * Pixel line pitch at \`fontSizePx\`, replicating Godot's Label line-height
 * computation exactly rather than a raw float scale of the hhea table:
 *
 * - \`modules/text_server_adv/text_server_adv.cpp:1515-1516\` — Godot's
 *   TextServerAdvanced reads FreeType's PIXEL-QUANTIZED 26.6 fixed-point size
 *   metrics (\`face->size->metrics.ascender\` / \`.descender\`), which round
 *   each metric UP to a whole pixel independently. Summing raw floats
 *   (ascent+descent as floats, THEN rounding once) undershoots by ~1px
 *   system-wide — confirmed against real Godot pixels (packet P10 spike S2).
 *   So ascent and descent must each be ceiling-rounded to a whole pixel
 *   INDEPENDENTLY, before summing.
 * - \`scene/theme/default_theme.cpp:392\` — Label's \`line_spacing\` theme
 *   constant is \`Math::round(3 * scale)\`; \`lineSpacingPx\` defaults to 3 (UI
 *   scale 1.0).
 *
 * At size 16: ceil(${metrics.ascent} * 16/${metrics.unitsPerEm}) + ceil(${metrics.descent} * 16/${metrics.unitsPerEm}) + 3 = 26.
 */
export function getLinePitchPx(fontSizePx: number, lineSpacingPx = 3): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  const ascentPx = Math.ceil(OPEN_SANS_METRICS.ascent * scale);
  const descentPx = Math.ceil(OPEN_SANS_METRICS.descent * scale);
  return ascentPx + descentPx + lineSpacingPx;
}
`;
}

function renderAtlasModule({ pngDataUrl, glyphsByChar, atlasInfo }) {
  return `${GENERATED_HEADER}
// The glyph table and atlas image below are generated data (base64 + a
// per-glyph JSON table for 95 ASCII glyphs) on single very long lines; this
// file is excluded from lint entirely via eslint.config.js's ignore list.

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
  /** Pen advance to the next glyph, atlas-bake-size px (same \`hmtx\` source as \`OpenSansMetrics\`, scaled to \`OPEN_SANS_ATLAS_INFO.fontSize\`). */
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

/** Keyed by character, full ASCII printable 0x20-0x7E (95 glyphs) — decided in packet P10, do not narrow it. */
export const OPEN_SANS_ATLAS_GLYPHS: Record<string, OpenSansGlyph> = ${JSON.stringify(glyphsByChar)};

/** MSDF atlas texture (\`distanceField.fieldType: "msdf"\`), inline so it rides \`img-src ... data:\` under the VS Code webview CSP (ADR-0003; packet P10 spike S1). */
export const OPEN_SANS_ATLAS_PNG_DATA_URL = ${JSON.stringify(pngDataUrl)};
`;
}

async function bake() {
  const { font, ttfBuffer } = await loadFont();
  const kerning = bakeKerning(font);
  const metrics = bakeMetrics(font, kerning);
  const { png, glyphsByChar, atlasInfo } = await bakeAtlas(ttfBuffer);
  const pngDataUrl = `data:image/png;base64,${png.toString('base64')}`;

  return {
    metricsSource: renderMetricsModule(metrics),
    atlasSource: renderAtlasModule({ pngDataUrl, glyphsByChar, atlasInfo }),
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const { metricsSource, atlasSource } = await bake();

  if (check) {
    let stale = false;
    for (const [path, expected] of [
      [METRICS_OUT, metricsSource],
      [ATLAS_OUT, atlasSource],
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
  console.log(`[bake-metrics] wrote ${METRICS_OUT}`);
  console.log(`[bake-metrics] wrote ${ATLAS_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
