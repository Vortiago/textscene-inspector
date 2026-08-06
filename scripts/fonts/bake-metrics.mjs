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

// Full ASCII printable, 0x20 (space) .. 0x7E (~) — 95 glyphs. Do not narrow it.
const CHARSET_START = 0x20;
const CHARSET_END = 0x7e;

// Latin-1 Supplement, 0xA0 (NBSP) .. 0xFF (ÿ) — the standard second tier for
// European-language coverage (accented Latin letters used by French, German,
// Spanish, etc.), independent of any single Godot call site. 0xAD (SOFT
// HYPHEN) is deliberately EXCLUDED: it is a Unicode Cf (Format) character —
// invisible by design, a hyphenation hint, not a printable glyph — and this
// specific font maps it to a visible hyphen-shaped bitmap with unusually
// large GPOS kerning against nearly every other baked character (verified:
// 199 kerning pairs, all involving 0xAD, once it was in this range). Nothing
// in Godot's own defaults or this repo's scene fixtures needs it rendered,
// and baking it would assert a specific visible-ink behavior for a format
// character this packet never measured against real Godot.
const LATIN1_SUPPLEMENT_START = 0xa0;
const LATIN1_SUPPLEMENT_END = 0xff;
const LATIN1_SUPPLEMENT_EXCLUDE = new Set([0xad]);

// Individual punctuation codepoints outside both ranges above, each with its
// own reason to be baked rather than silently falling back:
const EXTRA_CODEPOINTS = [
  0x2022, // BULLET — LineEdit's default `secret_character` when the scene sets none (`line_edit.cpp:3094`: `secret_character.is_empty() ? U"•" : ...`).
  0x2026, // HORIZONTAL ELLIPSIS — Label's default overrun/truncation character (`label.cpp:294`, three sibling call sites at :299/:324/:328: `(el_char.length() > 0) ? el_char[0] : 0x2026`).
  0x2013, // EN DASH — common scene-author prose punctuation (not itself a Godot GUI default literal).
  0x2014, // EM DASH — ditto; the character this repo's own ScrollContainer fixture's Label text uses.
  0x2018,
  0x2019, // single curly quotes — common scene-author prose punctuation.
  0x201c,
  0x201d, // double curly quotes — ditto.
];

const CHARSET = [];
for (let cp = CHARSET_START; cp <= CHARSET_END; cp++) CHARSET.push(String.fromCodePoint(cp));
for (let cp = LATIN1_SUPPLEMENT_START; cp <= LATIN1_SUPPLEMENT_END; cp++) {
  if (!LATIN1_SUPPLEMENT_EXCLUDE.has(cp)) CHARSET.push(String.fromCodePoint(cp));
}
for (const cp of EXTRA_CODEPOINTS) CHARSET.push(String.fromCodePoint(cp));

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
 * GPOS/kern pairwise advance adjustments over the full CHARSET x CHARSET
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

/**
 * Per-glyph `hmtx` advance width, design units, over the SAME `CHARSET` the
 * atlas bakes — the CONTINUOUS source `textLayout.ts`'s `glyphAdvancePx` now
 * scales directly, instead of `openSansAtlas.ts`'s `xadvance` (msdf-bmfont-xml's
 * OWN atlas-bake-resolution-42 glyph table, INTEGER-rounded at that bake size
 * before this script ever sees it — confirmed empirically: msdf-bmfont-xml's
 * `roundDecimal` option defaults to `null` — no rounding — yet its own output
 * for this font is already whole pixels at size 42, so the rounding is
 * upstream, in the atlas-bake tool itself). Godot's real advance at ANY UI
 * font size (`text_server_adv.cpp:7078`, `subpos` true whenever
 * `SUBPIXEL_POSITIONING_AUTO` and `font_size <= 20` — true for every theme
 * default and every fixture this repo ships) is NEVER rounded per glyph: it
 * is HarfBuzz's `x_advance`, itself FreeType's UNHINTED (`hb-ft.cc:115`'s
 * default `FT_LOAD_NO_HINTING`) advance — a plain proportional scale of this
 * SAME `hmtx` table, continuous down to floating-point precision. Baking a
 * SEPARATE continuous table (rather than reusing the atlas's own
 * bake-size-42-quantized one) closes that residual: measured on
 * `unit-rich-text-label.tscn`'s 45-character line against real Godot 4.6.3,
 * reusing the atlas's own `xadvance` left the line's ink 1px wider than
 * Godot's own render even after the (much larger) per-style-run font-size fix
 * (nativeSolver.ts's `resolveRunFontSizePx`) closed the rest.
 */
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
    // `post` table, design units — `fontkit`'s `TTFFont#underlinePosition`/
    // `#underlineThickness` read `post.underlinePosition`/`post.underlineThickness`
    // directly (fontkit's `src/tables/post.js`, `src/TTFFont.js:189-201`), the
    // SAME raw values FreeType exposes as `face->underline_position`/
    // `face->underline_thickness` — what `text_server_adv.cpp:1517-1518` scales
    // to pixels (see `getUnderlinePositionPx`/`getUnderlineThicknessPx` below).
    underlinePosition: font.underlinePosition,
    underlineThickness: font.underlineThickness,
    // OS/2 `xAvgCharWidth`, design units — a standard per-font "typical
    // glyph width" metric (the same field browsers/other engines already
    // use to estimate the width of a character they cannot shape) rather
    // than a magic constant. Used as the fallback advance for a codepoint
    // outside the baked charset — see `OPEN_SANS_ATLAS_GLYPHS`'s doc in
    // `renderAtlasModule` and `textLayout.ts`'s `glyphAdvancePx`.
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
      },
      (err, textures, font) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        // Everything below runs inside the library's own callback, not the
        // executor, so a `throw` here would escape as an unhandled exception
        // rather than rejecting this promise — hence the explicit reject.
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
 * placement inside the PNG, at the atlas's bake-size-42 resolution), rounded
 * to whole atlas-bake pixels by msdf-bmfont-xml itself before this script
 * ever reads it back, where THIS advance is a direct, unrounded \`hmtx\` scale
 * — see \`getGlyphAdvanceUnits\`'s own doc for why a shaper never wants the
 * ATLAS's rounded copy.
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
   * \`post\` table \`underlinePosition\`, design units — the top of the underline
   * stroke relative to the baseline, POSITIVE = above baseline (the \`post\`
   * table's own Y-up convention; typically negative for a below-baseline
   * underline). Read via \`fontkit\`'s \`TTFFont#underlinePosition\`
   * (\`fontkit/src/TTFFont.js:192-194\`, itself \`post.underlinePosition\`),
   * matching FreeType's \`face->underline_position\` — the same field
   * \`text_server_adv.cpp:1517\` scales to pixels for \`shaped_text_get_underline_position\`.
   */
  underlinePosition: number;
  /** \`post\` table \`underlineThickness\`, design units — see \`underlinePosition\`'s doc; scaled by \`text_server_adv.cpp:1518\`. */
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
 * This is the CONTINUOUS source \`textLayout.ts\` scales to a target pixel
 * size — never \`openSansAtlas.ts\`'s own \`xadvance\`, which is msdf-bmfont-xml's
 * OWN atlas-bake-resolution glyph table (bake size 42, INTEGER-rounded at
 * THAT resolution before this repo's bake script ever sees it) and therefore
 * carries roughly 1/2 an atlas-bake-pixel of quantization noise per glyph —
 * negligible at the atlas's own 42px bake size, but the SAME absolute error
 * persists after scaling down to a UI font size (16-18px), where it is a much
 * larger fraction of each glyph's own advance and accumulates roughly
 * linearly with line length. Godot's own real per-glyph advance
 * (\`text_server_adv.cpp:7078\`) is HarfBuzz's unrounded \`x_advance\` whenever
 * \`subpos\` is true — true for \`SUBPIXEL_POSITIONING_AUTO\` (Godot's own
 * default) at every font size this engine ships (\`<=\`
 * \`SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE\`, 20px, \`servers/text/
 * text_server.h:172\`) — itself FreeType's UNHINTED advance
 * (\`thirdparty/harfbuzz/src/hb-ft.cc:115\`'s default \`FT_LOAD_NO_HINTING\`), a
 * plain proportional scale of this SAME \`hmtx\` table with no rounding
 * anywhere in the chain. This getter is that same continuous scale.
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
 *   ~1px system-wide, confirmed against real Godot pixels, packet P10 spike
 *   S2).
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
 * \`text_server_adv.cpp:1517\`: \`fd->underline_position = (-FT_MulFix(face->underline_position,
 * size->metrics.y_scale) / 64.0) * fd->scale\` — a plain proportional scale of
 * the \`post\` table value (NOT ceiling-rounded like ascent/descent; FreeType's
 * \`y_scale\` here is the raw 26.6 size scale, not a hinted metric), NEGATED so
 * a below-baseline \`post\` value (negative, that table's Y-up convention)
 * becomes a positive DOWNWARD pixel offset from the baseline —
 * \`rich_text_label.cpp:1242-1244\`'s \`y_off = upos\` is added directly to the
 * baseline y (\`off_step.y\`, itself \`off.y\` after \`+= l_ascent\`) with no
 * further sign flip.
 *
 * At size 16: -(-100) * 16/2048 = 0.78125.
 */
export function getUnderlinePositionPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return -OPEN_SANS_METRICS.underlinePosition * scale;
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
   * msdf-bmfont-xml's OWN glyph-table advance, atlas-bake-size (42) px —
   * INTEGER-rounded at that resolution by the atlas-bake tool itself before
   * this script ever reads it back (confirmed empirically against the
   * vendored font; msdf-bmfont-xml's own \`roundDecimal\` option, which would
   * explain an INTENTIONAL round, defaults to \`null\`/off). NOT the glyph
   * shaper's advance source: \`openSansMetrics.ts\`'s \`getGlyphAdvanceUnits\`
   * (backed by this SAME \`hmtx\` table, at full floating-point precision) is
   * — see that function's own doc for why the atlas-bake-resolution rounding
   * here is a real, measured source of drift a shaper must not inherit. Kept
   * only as atlas metadata a consumer might reasonably expect a glyph-info
   * table to carry; \`textLayout.ts\` never reads this field.
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

/** MSDF atlas texture (\`distanceField.fieldType: "msdf"\`), inline so it rides \`img-src ... data:\` under the VS Code webview CSP (ADR-0003; packet P10 spike S1). */
export const OPEN_SANS_ATLAS_PNG_DATA_URL = ${JSON.stringify(pngDataUrl)};
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
