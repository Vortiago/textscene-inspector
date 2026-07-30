/**
 * Framework-free line-breaking + glyph placement for the native (WebGL)
 * Control text engine — a port of Godot's Label shaping against the vendored
 * Open Sans SemiBold atlas/metrics.
 *
 * Two sources, two responsibilities, deliberately kept separate:
 *  - `openSansAtlas.ts` — the ONLY per-glyph advance table (`xadvance`, atlas
 *    bake size 42px). Every advance below is that table scaled to the target
 *    font size; nothing here duplicates it.
 *  - `openSansMetrics.ts` — font-wide ascent/descent/kerning, and the already
 *    Godot-exact `getLinePitchPx` (ceiling-rounds ascent and descent to whole
 *    pixels independently before summing, rather than a raw float sum, which
 *    undershoots Godot's real pitch by ~1px system-wide).
 *
 * Line-breaking is a direct port of two Godot functions:
 *   scene/gui/label.cpp :: Label::_shape() (~209-225) — maps
 *     `Label.autowrap_mode` to TextServer break flags:
 *       AUTOWRAP_OFF          -> (no wrap flags; only the paragraph's own
 *                                 hard breaks apply)
 *       AUTOWRAP_ARBITRARY    -> BREAK_GRAPHEME_BOUND | BREAK_MANDATORY
 *       AUTOWRAP_WORD         -> BREAK_WORD_BOUND | BREAK_MANDATORY
 *       AUTOWRAP_WORD_SMART   -> BREAK_WORD_BOUND | BREAK_ADAPTIVE | BREAK_MANDATORY
 *     ORed with `autowrap_flags_trim`, whose Label-level DEFAULT (label.h:45)
 *     is BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES — every
 *     Label trims the edge space at a break even when the scene authors no
 *     trim flags, so that default is baked in here rather than an option.
 *   servers/text/text_server.cpp :: TextServer::shaped_text_get_line_breaks()
 *     (~1024-1209) — the scalar-width overload Label::_shape() actually calls
 *     (not the multi-chunk `_adv` sibling): the width/lastSafeBreak/wordCount
 *     bookkeeping, the overflow check, the TRIM_START/END branch walking
 *     start/end back off edge spaces, and the tail rule for the remainder.
 *     `width <= 0` disables the overflow check entirely (`width > 0 &&` in
 *     the source), which is what makes AUTOWRAP_OFF fall out of the SAME
 *     function with no special-casing: pass an unconstrained width and only
 *     the (always-on) hard-break branch below can still start a new line.
 *   modules/text_server_adv/text_server_adv.cpp :: _shaped_text_update_breaks()
 *     (~6258-6420) — ICU's UAX#14 line-break iterator populates
 *     GRAPHEME_IS_BREAK_SOFT; for plain space-separated ASCII that reduces to
 *     one rule reproduced below: the space glyph itself is the soft-break
 *     candidate (BREAK_WORD_BOUND), and BREAK_GRAPHEME_BOUND instead treats
 *     every glyph position as one.
 *   text_server.cpp:1174-1176 — BREAK_ADAPTIVE: a mid-word fallback break,
 *     live only while `wordCount === 0` (no word boundary found yet on the
 *     current line) — required so a single word wider than its box still
 *     wraps under WORD_SMART instead of overflowing (that overflow IS what
 *     plain WORD, lacking this flag, does instead).
 *   core/string/char_utils.h :: is_whitespace() / is_linebreak() — exact
 *     codepoint ranges, transcribed in full for fidelity though only the
 *     ASCII space and LF/CR are reachable by this engine's glyph set.
 *   scene/theme/default_theme.cpp:392 — Label's `line_spacing` theme
 *     constant, `round(3 * scale)`; `lineSpacingPx` defaults to 3 here (UI
 *     scale 1.0), matching `getLinePitchPx`'s own default.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { OPEN_SANS_ATLAS_GLYPHS, OPEN_SANS_ATLAS_INFO, type OpenSansGlyph } from './openSansAtlas';
import { OPEN_SANS_METRICS, getKerningAdjustmentUnits, getLinePitchPx } from './openSansMetrics';

/** Godot `TextServer::AutowrapMode` (`core/templates/rid.h`-adjacent enum; values match the engine's). */
export enum AutowrapMode {
  OFF = 0,
  ARBITRARY = 1,
  WORD = 2,
  WORD_SMART = 3,
}

/**
 * Narrows a parsed `autowrap_mode` to the enum, falling back when the value is
 * absent or outside it — the same silent-lenient handling `parseOptionalInt`
 * already applies at parse time.
 *
 * The fallback differs per Control and is the caller's to state: `Label`
 * defaults to `OFF`, `RichTextLabel` to `WORD_SMART` (`rich_text_label.h:557`).
 */
export function clampAutowrapMode(mode: number | undefined, fallback: AutowrapMode): AutowrapMode {
  switch (mode) {
    case AutowrapMode.OFF:
    case AutowrapMode.ARBITRARY:
    case AutowrapMode.WORD:
    case AutowrapMode.WORD_SMART:
      return mode;
    default:
      return fallback;
  }
}

export interface ShapeTextOptions {
  /** Target render font size, px. Atlas advances (baked at 42px) scale by `fontSizePx / 42`. */
  fontSizePx: number;
  /** Wrap width, px. `<= 0` means unconstrained — no soft wrap, only hard breaks. */
  boxWidthPx: number;
  autowrapMode: AutowrapMode;
  /** `Label.uppercase` — shapes `text.toUpperCase()`, not the source casing. */
  uppercase?: boolean;
  /** `default_theme.cpp:392`'s `line_spacing` constant, px. Default 3 (UI scale 1.0). */
  lineSpacingPx?: number;
}

/** One glyph's placement within its line, in target-font-size px. */
export interface GlyphPlacement {
  /** The character rendered (post-uppercase-transform, if requested). */
  char: string;
  /** Pen-origin x within the line — left edge of this glyph's ADVANCE box, not its ink. */
  x: number;
  /**
   * This glyph's own advance to the next glyph's pen x, target px. Includes
   * any kerning adjustment against the FOLLOWING glyph (kerning narrows or
   * widens the gap between a pair, and is folded into the leading glyph's
   * advance so a single running sum serves both the line-break width check
   * and this placement pass with no second calculation to drift from it).
   */
  advance: number;
  /** Atlas bitmap metadata for this glyph, or `null` if the atlas has none (outside the vendored ASCII set). */
  glyph: OpenSansGlyph | null;
}

export interface TextLineLayout {
  /** The rendered text of this line, edge-space-trimmed per Label's default. */
  text: string;
  glyphs: GlyphPlacement[];
  /** Sum of every glyph's advance on this line, target px. */
  widthPx: number;
}

export interface TextLayoutResult {
  lines: TextLineLayout[];
  /** `getLinePitchPx(fontSizePx, lineSpacingPx)` — every line uses the same pitch. */
  linePitchPx: number;
  /** The widest line's `widthPx`. */
  widthPx: number;
  /** `lines.length * linePitchPx`. */
  heightPx: number;
}

interface BreakFlags {
  /** BREAK_WORD_BOUND — a space glyph is a safe break point. */
  wordBound: boolean;
  /** BREAK_GRAPHEME_BOUND — every glyph position is a safe break point. */
  graphemeBound: boolean;
  /** BREAK_ADAPTIVE — mid-word fallback break, live only while `wordCount === 0`. */
  adaptive: boolean;
}

function breakFlagsForAutowrap(mode: AutowrapMode): BreakFlags {
  switch (mode) {
    case AutowrapMode.ARBITRARY:
      return { wordBound: false, graphemeBound: true, adaptive: false };
    case AutowrapMode.WORD:
      return { wordBound: true, graphemeBound: false, adaptive: false };
    case AutowrapMode.WORD_SMART:
      return { wordBound: true, graphemeBound: false, adaptive: true };
    case AutowrapMode.OFF:
    default:
      return { wordBound: false, graphemeBound: false, adaptive: false };
  }
}

// core/string/char_utils.h :: is_whitespace() / is_linebreak().
function isWhitespace(cp: number): boolean {
  return (
    cp === 0x20 ||
    cp === 0x00a0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200b) ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000 ||
    cp === 0x2028 ||
    cp === 0x2029 ||
    (cp >= 0x0009 && cp <= 0x000d) ||
    cp === 0x0085
  );
}
function isLinebreak(cp: number): boolean {
  return (cp >= 0x000a && cp <= 0x000d) || cp === 0x0085 || cp === 0x2028 || cp === 0x2029;
}

interface BreakGlyph {
  start: number;
  end: number;
  advance: number;
  isSpace: boolean;
  isHardBreak: boolean;
}

/** Atlas `xadvance` (bake size 42) scaled to `fontSizePx`. 0 for a character outside the vendored set. */
function glyphAdvancePx(ch: string, fontSizePx: number): number {
  const g = OPEN_SANS_ATLAS_GLYPHS[ch];
  if (!g) return 0;
  return g.xadvance * (fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize);
}

/** `getKerningAdjustmentUnits`, design units, scaled to `fontSizePx` via `unitsPerEm`. */
function kerningAdjustmentPx(a: string, b: string, fontSizePx: number): number {
  const units = getKerningAdjustmentUnits(a, b);
  if (units === 0) return 0;
  return units * (fontSizePx / OPEN_SANS_METRICS.unitsPerEm);
}

/**
 * One glyph per character plus the paragraph terminator Label always appends
 * (`label.cpp:164`, a zero-advance whitespace glyph — itself a trailing break
 * candidate, though it never changes visible layout since it carries no ink
 * and no advance).
 */
function toBreakGlyphs(text: string, fontSizePx: number): BreakGlyph[] {
  const glyphs: BreakGlyph[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    glyphs.push({
      start: i,
      end: i + 1,
      advance: glyphAdvancePx(ch, fontSizePx),
      isSpace: isWhitespace(ch.codePointAt(0)!),
      isHardBreak: isLinebreak(ch.codePointAt(0)!),
    });
  }
  // Kerning narrows/widens the gap BETWEEN a pair; folding it into the
  // leading glyph's own advance keeps one cumulative sum for both the
  // line-break width check and the placement pass below.
  for (let i = 0; i + 1 < text.length; i++) {
    glyphs[i]!.advance += kerningAdjustmentPx(text[i]!, text[i + 1]!, fontSizePx);
  }
  glyphs.push({ start: text.length, end: text.length + 1, advance: 0, isSpace: true, isHardBreak: false });
  return glyphs;
}

/**
 * Port of `TextServer::shaped_text_get_line_breaks` (the scalar-width
 * overload). Returns `[start, end)` character ranges, one pair per line, with
 * Label's default edge-space trim already applied to the emitted range (the
 * width check above still counted the trimmed space's advance — trimming
 * only narrows what gets EMITTED, never what decided the break).
 */
function shapedTextGetLineBreaks(glyphs: BreakGlyph[], width: number, flags: BreakFlags): Array<[number, number]> {
  const lSize = glyphs.length;
  const rangeEnd = lSize > 0 ? glyphs[lSize - 1]!.end : 0;

  const lines: Array<[number, number]> = [];
  let width_ = 0;
  let lineStart = 0;
  let lastEnd = lineStart;
  let prevSafeBreak = 0;
  let lastSafeBreak = -1;
  let wordCount = 0;
  let trimNext = false;

  const isSpaceOrBreak = (idx: number): boolean => glyphs[idx]!.isSpace || glyphs[idx]!.isHardBreak;

  for (let i = 0; i < lSize; i++) {
    const g = glyphs[i]!;
    const adv = g.advance;

    // Overflow check: would adding this glyph exceed the line width, with a
    // recorded safe break to fall back to? `width <= 0` disables this whole
    // branch (AUTOWRAP_OFF's unconstrained width), leaving only hard breaks.
    if (width > 0 && width_ + adv > width && lastSafeBreak >= 0) {
      const curSafeBrk = lastSafeBreak;

      // BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES (Label's
      // always-on default) — walk start/end back off edge spaces.
      let startPos = prevSafeBreak;
      let endPos = lastSafeBreak;
      while (trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        lastEnd = glyphs[endPos]!.end;
      }
      trimNext = true;

      lineStart = glyphs[curSafeBrk]!.end;
      prevSafeBreak = curSafeBrk + 1;
      while (prevSafeBreak < lSize && glyphs[prevSafeBreak]!.end === lineStart) prevSafeBreak++;
      i = curSafeBrk;
      lastSafeBreak = -1;
      width_ = 0;
      wordCount = 0;
      continue;
    }

    // BREAK_MANDATORY — always on, independent of autowrap mode (Label
    // paragraph-splits on a hard break regardless of wrap setting).
    if (g.isHardBreak) {
      const curSafeBrk = i;
      let startPos = prevSafeBreak;
      let endPos = i;
      while (trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        lastEnd = glyphs[i]!.end;
      }
      trimNext = true;
      lineStart = glyphs[curSafeBrk]!.end;
      prevSafeBreak = curSafeBrk + 1;
      while (prevSafeBreak < lSize && glyphs[prevSafeBreak]!.end === lineStart) prevSafeBreak++;
      lastSafeBreak = -1;
      width_ = 0;
      wordCount = 0;
      continue;
    }

    if (flags.wordBound && g.isSpace) {
      lastSafeBreak = i;
      wordCount++;
    }
    if (flags.graphemeBound) {
      lastSafeBreak = i;
    }
    if (flags.adaptive && wordCount === 0) {
      lastSafeBreak = i;
    }

    width_ += adv;
  }

  // Tail: whatever remains after the last break becomes the final line.
  if (lSize > 0) {
    const last = lines.length ? lines[lines.length - 1]! : null;
    if (!last || (last[1] < rangeEnd && prevSafeBreak < lSize)) {
      const startPos0 = prevSafeBreak < lSize ? prevSafeBreak : lSize - 1;
      let finalStart: number;
      if (lastEnd <= glyphs[startPos0]!.start) {
        let startPos = startPos0;
        const endPos = lSize - 1;
        while (trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
        finalStart = glyphs[startPos]!.start;
      } else {
        finalStart = lastEnd;
      }
      lines.push([finalStart, rangeEnd]);
    }
  } else {
    lines.push([0, 0]);
  }

  return lines;
}

/** Shapes `text` into lines and per-glyph placements at `options.fontSizePx`. */
export function shapeText(text: string, options: ShapeTextOptions): TextLayoutResult {
  const { fontSizePx, boxWidthPx, autowrapMode, uppercase = false, lineSpacingPx = 3 } = options;
  const transformed = uppercase ? text.toUpperCase() : text;
  const flags = breakFlagsForAutowrap(autowrapMode);
  // AUTOWRAP_OFF never soft-wraps: force an unconstrained width regardless of
  // what the caller passed, so only the always-on hard-break branch can
  // start a new line (mirrors Label::_shape() never OR-ing a wrap flag in).
  const effectiveWidth = autowrapMode === AutowrapMode.OFF ? 0 : boxWidthPx;

  const breakGlyphs = toBreakGlyphs(transformed, fontSizePx);
  const ranges = shapedTextGetLineBreaks(breakGlyphs, effectiveWidth, flags);
  const linePitchPx = getLinePitchPx(fontSizePx, lineSpacingPx);

  const lines: TextLineLayout[] = ranges.map(([start, end]) => {
    const clampedEnd = Math.min(end, transformed.length);
    const lineText = transformed.slice(start, clampedEnd);
    let penX = 0;
    const glyphs: GlyphPlacement[] = [];
    for (let idx = start; idx < clampedEnd; idx++) {
      const ch = transformed[idx]!;
      const bg = breakGlyphs[idx]!;
      glyphs.push({ char: ch, x: penX, advance: bg.advance, glyph: OPEN_SANS_ATLAS_GLYPHS[ch] ?? null });
      penX += bg.advance;
    }
    return { text: lineText, glyphs, widthPx: penX };
  });

  const widthPx = lines.reduce((max, l) => Math.max(max, l.widthPx), 0);
  const heightPx = lines.length * linePitchPx;

  return { lines, linePitchPx, widthPx, heightPx };
}
