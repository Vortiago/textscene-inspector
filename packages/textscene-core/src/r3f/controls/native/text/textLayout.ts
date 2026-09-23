/**
 * Framework-free line breaking and glyph placement for the native (WebGL) Control text engine: a
 * port of Godot's Label shaping against a `FontMetrics`.
 *
 * Shaping metrics come from `options.fontMetrics`, by default `OPEN_SANS_FONT_METRICS`, and the
 * px-quantisation math lives once in `fontMetrics.ts`. Atlas bitmaps are looked up only for an
 * `'atlas'` font: a `'canvas'` scene font gets `glyph: null` and `TextRun.tsx` rasterises it,
 * because an atlas lookup would give another font's advances Open Sans ink.
 *
 * Line breaking ports:
 *   scene/gui/label.cpp :: Label::_shape() (~209-225): maps `Label.autowrap_mode` to break flags:
 *       AUTOWRAP_OFF          -> no wrap flags, only hard breaks
 *       AUTOWRAP_ARBITRARY    -> BREAK_GRAPHEME_BOUND | BREAK_MANDATORY
 *       AUTOWRAP_WORD         -> BREAK_WORD_BOUND | BREAK_MANDATORY
 *       AUTOWRAP_WORD_SMART   -> BREAK_WORD_BOUND | BREAK_ADAPTIVE | BREAK_MANDATORY
 *     ORed with `autowrap_flags_trim`, which defaults to both edge-space trims (label.h:45).
 *   servers/text/text_server.cpp :: TextServer::shaped_text_get_line_breaks() (~1024-1209), the
 *     scalar-width overload Label calls. `width <= 0` disables the overflow check, so AUTOWRAP_OFF
 *     passes an unconstrained width and only hard breaks start a line.
 *   modules/text_server_adv/text_server_adv.cpp :: _shaped_text_update_breaks() (~6258-6420): for
 *     space-separated text, UAX#14 soft breaks reduce to the space glyph (BREAK_WORD_BOUND), and
 *     BREAK_GRAPHEME_BOUND makes every glyph position one.
 *   text_server.cpp:1174-1176: BREAK_ADAPTIVE breaks mid-word while `wordCount === 0`, so under
 *     WORD_SMART a word wider than its box wraps, where plain WORD overflows.
 *   core/string/char_utils.h :: is_whitespace() / is_linebreak(): the full codepoint ranges.
 *   scene/theme/default_theme.cpp:392: Label's `line_spacing` constant, `round(3 * scale)`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { OPEN_SANS_ATLAS_GLYPHS, type OpenSansGlyph } from './openSansAtlas';
import { round as godotRound } from '../../../../godot/math';
import { hexCodeBoxAdvanceSize } from './hexCodeBox';
import {
  fontUsesSubpixelPositioning,
  getFontAscentPx,
  getFontGlyphAdvancePx,
  getFontKerningAdjustmentPx,
  getFontLinePitchPx,
  type FontMetrics,
} from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { tabAlignAdvances } from './textTabStops';

/** Godot `TextServer::AutowrapMode` (`servers/text/text_server.h:98`), with the engine's values. */
export enum AutowrapMode {
  OFF = 0,
  ARBITRARY = 1,
  WORD = 2,
  WORD_SMART = 3,
}

/**
 * Narrows a parsed `autowrap_mode` to the enum, else returns `fallback`, as leniently as
 * `parseOptionalInt`. The fallback is the caller's: `Label` uses `OFF`, `RichTextLabel` uses
 * `WORD_SMART` (`rich_text_label.h:557`).
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
  /** Target render font size, px, for every character when `fontSizePxAt` is absent. Atlas bitmaps, baked at 42 px, scale by `fontSizePx / 42`. */
  fontSizePx: number;
  /** Wrap width, px. `<= 0` means unconstrained: no soft wrap, only hard breaks. */
  boxWidthPx: number;
  /**
   * `BREAK_TRIM_INDENT` (`servers/text/text_server.cpp:1048-1062`): measures the leading tabs and
   * spaces once, caps the run at `0.6 * boxWidthPx`, and breaks each later row at
   * `boxWidthPx - indent`. Only `TextEdit.indent_wrapped_lines` sets it (`text_edit.cpp:285-287`).
   */
  trimIndent?: boolean;
  autowrapMode: AutowrapMode;
  /** `Label.uppercase`: shapes `text.toUpperCase()`, not the source casing. */
  uppercase?: boolean;
  /**
   * The theme `line_spacing`, px. Required, because it is a per-control constant: Label 3
   * (`LABEL_LINE_SPACING_PX`), Button-family and LineEdit 0, RichTextLabel `line_separation` 0
   * (`default_theme.cpp:1217`), Label3D its authored `line_spacing`. A miss is a 1-3 px shift.
   */
  lineSpacingPx: number;
  /**
   * Per-character font size, keyed by index into the post-uppercase text: RichTextLabel `[b]`/`[i]`
   * spans shape at their own `*_font_size` key, never `normal_font_size` (`rich_text_label.cpp:3244-3290`).
   * Kerning is skipped between characters of different sizes, as HarfBuzz shapes each Item apart.
   */
  fontSizePxAt?: (charIndex: number) => number;
  /** The `FontMetrics` to shape against, by default `OPEN_SANS_FONT_METRICS`. Only an `'atlas'` font gets `GlyphPlacement.glyph`. */
  fontMetrics?: FontMetrics;
  /**
   * `Label.paragraph_separator`, which callers pass as the engine default `'\n'`. The text splits on
   * it first, and each paragraph ends with a ZERO WIDTH SPACE (`label.cpp:158-166`). The break loop
   * drops an empty range (`text_server.cpp:948`), so the terminator gives a blank paragraph its line.
   */
  paragraphSeparator?: string;
  /**
   * `Label.tab_stops` and `TextParagraph.tab_stops`, px, applied twice as `Label::_shape` does
   * (`label.cpp:196-198,228-230`): over the paragraph before line breaking, so the aligned advance
   * decides the wrap, then per line from its own pen origin. Undefined or empty is a no-op.
   */
  tabStopsPx?: number[];
  /**
   * `Label.autowrap_trim_flags`. Only `BREAK_TRIM_START_EDGE_SPACES` (64) and
   * `BREAK_TRIM_END_EDGE_SPACES` (128) are read, not `BREAK_TRIM_INDENT` (32). Undefined turns both
   * trims on (`label.h:45`).
   */
  autowrapTrimFlags?: number;
  /**
   * `TextServer::shaped_text_set_preserve_control`: keeps a control character as a hex-code box glyph
   * (`text/hexCodeBox.ts`) instead of dropping it at zero width. Only the `draw_control_chars` property
   * of `LineEdit` and `TextEdit` sets it.
   */
  preserveControl?: boolean;
}

/** `TextServer::LineBreakFlag` subset this module reads (`servers/text/text_server.h:113-120`). */
const BREAK_TRIM_START_EDGE_SPACES = 1 << 6;
const BREAK_TRIM_END_EDGE_SPACES = 1 << 7;

/** One glyph's placement within its line, in target-font-size px. */
export interface GlyphPlacement {
  /** The character rendered (post-uppercase-transform, if requested). */
  char: string;
  /** Pen-origin x within the line: the left edge of the glyph's advance box, not its ink. */
  x: number;
  /**
   * The advance to the next glyph's pen x, target px. It includes the kerning against the following
   * glyph, so one running sum serves the line-break width check and placement.
   */
  advance: number;
  /** Atlas bitmap metadata, or `null` outside the baked charset or for a non-`'atlas'` `FontMetrics`. */
  glyph: OpenSansGlyph | null;
  /** The control character this glyph draws as a hex-code box (`draw_hex_code_box`), set only when `preserveControl` kept it. */
  controlCodepoint?: number;
}

export interface TextLineLayout {
  /** The rendered text of this line, edge-space-trimmed per Label's default. */
  text: string;
  glyphs: GlyphPlacement[];
  /**
   * The sum of the line's advances, target px: Godot's raw pen extent `sd->width`. The size the
   * engine reports (`shaped_text_get_size`) goes through `shapedTextSizeWidthPx`.
   */
  widthPx: number;
}

/**
 * `_shaped_text_get_size` reports `Size2(sd->width, ascent + descent).ceil()`
 * (`modules/text_server_adv/text_server_adv.cpp:7524-7537`), and `shaped_text_get_width` ceils the
 * same width (`:7561-7570`). The ceil runs toward positive infinity, as `Vector2::ceil()` does.
 */
export function shapedTextSizeWidthPx(widthPx: number): number {
  // `GridContainer` truncates each minimum into `Size2i col_minw` (`grid_container.cpp:290`), so a
  // minimum a fraction below the pixel opens every later column one pixel early.
  return Math.ceil(widthPx);
}

export interface TextLayoutResult {
  lines: TextLineLayout[];
  /** `getFontLinePitchPx(fontMetrics, fontSizePx, lineSpacingPx)`, one pitch for every line. */
  linePitchPx: number;
  /** The widest line's `widthPx`. */
  widthPx: number;
  /** `lines.length * linePitchPx`. */
  heightPx: number;
  /**
   * `getFontAscentPx(fontMetrics, fontSizePx)`: the baseline, measured down from the line top. Both
   * painters anchor a line here, so a hand-built result must state it: a wrong default misses by a
   * whole ascent on the canvas path and by the bake anchor on the atlas path.
   */
  baselineOffsetPx: number;
  /**
   * The `FontMetrics` the layout was shaped against. `TextRun.tsx` dispatches on `.kind` between the
   * MSDF atlas and canvas painters, so an omitted value would put a scene font on the atlas path.
   */
  fontMetrics: FontMetrics;
}

/**
 * Re-wraps one shaped line as a one-line result drawn from y = 0; the caller's `<group>` supplies
 * the cumulative Y. It bypasses `shapeText`, so it echoes the parent's `fontMetrics` and baseline.
 * Override `baselineOffsetPx` for a RichTextLabel `[b]`/`[i]` run shaped at its own size.
 */
export function soloLineLayout(
  line: TextLineLayout,
  parent: TextLayoutResult,
  baselineOffsetPx: number = parent.baselineOffsetPx
): TextLayoutResult {
  return {
    lines: [line],
    linePitchPx: parent.linePitchPx,
    widthPx: line.widthPx,
    heightPx: parent.linePitchPx,
    baselineOffsetPx,
    fontMetrics: parent.fontMetrics,
  };
}

/**
 * Checks a painter's cached `NativeControlComponentProps.meta` at runtime, since painting an
 * unrelated object is a silent wrong picture. Duck-typed, because the result is plain data.
 * `fontMetrics` is checked by presence, because it decides which painter draws.
 */
export function isTextLayoutResult(value: unknown): value is TextLayoutResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<TextLayoutResult>;
  return (
    Array.isArray(v.lines) &&
    typeof v.linePitchPx === 'number' &&
    typeof v.widthPx === 'number' &&
    typeof v.heightPx === 'number' &&
    'fontMetrics' in v
  );
}

interface BreakFlags {
  /** BREAK_WORD_BOUND: a space glyph is a safe break point. */
  wordBound: boolean;
  /** BREAK_GRAPHEME_BOUND: every glyph position is a safe break point. */
  graphemeBound: boolean;
  /** BREAK_ADAPTIVE: a mid-word fallback break, live only while `wordCount === 0`. */
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
/** Shared with `textOverrun.ts` and `textJustify.ts`, which need the line breaker's edge-space predicate. */
export function isWhitespace(cp: number): boolean {
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

/** `GRAPHEME_IS_TAB`: tab (U+0009) or vertical tab (U+000B) (`text_server_adv.cpp:6369-6371`). */
export function isTabChar(ch: string): boolean {
  return ch === '\t' || ch === '';
}

/** `core/string/char_utils.h::is_control`: C0 controls and DEL through the C1 range, tab and linebreaks included. */
export function isControlChar(cp: number): boolean {
  return cp <= 0x001f || (cp >= 0x007f && cp <= 0x009f);
}

interface BreakGlyph {
  start: number;
  end: number;
  advance: number;
  isSpace: boolean;
  isHardBreak: boolean;
  /** `GRAPHEME_IS_TAB`, a flag apart from `GRAPHEME_IS_SPACE`. `BREAK_TRIM_INDENT` reads both (`text_server.cpp:1051`). */
  isTab: boolean;
  /** The codepoint this glyph draws as a hex-code box, set only when `preserveControl` kept a control character. */
  controlCodepoint?: number;
}

/**
 * The `hmtx` advance through `getFontGlyphAdvancePx`, the fixed-point chain of FreeType and HarfBuzz.
 * Not `xadvance` from `openSansAtlas.ts`, which is fixed at the 42 px bake size rather than
 * quantised at the shaped size. A character outside the charset advances by `averageAdvanceUnits`,
 * so it leaves a gap rather than collapsing the line.
 */
function glyphAdvancePx(ch: string, fontSizePx: number, metrics: FontMetrics): number {
  return getFontGlyphAdvancePx(metrics, ch, fontSizePx);
}

/**
 * Unicode category Zs, which with U+0009 is ICU's `u_isblank()`, half of the remainder reset at
 * `text_server_adv.cpp:7057`. Not `isWhitespace()`, which adds U+200B (Cf, no width) and U+2028 and
 * U+2029, which reach the reset through `is_linebreak()`.
 */
function isSpaceSeparator(cp: number): boolean {
  return (
    cp === 0x0020 ||
    cp === 0x00a0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200a) ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000
  );
}


/** `metrics.getKerningAdjustmentUnits` scaled to `fontSizePx` with `getFontKerningAdjustmentPx`. */
function kerningAdjustmentPx(a: string, b: string, fontSizePx: number, metrics: FontMetrics): number {
  return getFontKerningAdjustmentPx(metrics, a, b, fontSizePx);
}

/**
 * One glyph per character, plus the zero-advance whitespace terminator Label appends
 * (`label.cpp:164`). `fontSizePxAt`, when given, sets the size of each character.
 */
function toBreakGlyphs(
  text: string,
  fontSizePx: number,
  metrics: FontMetrics,
  fontSizePxAt?: (charIndex: number) => number,
  preserveControl = false
): BreakGlyph[] {
  const sizeAt = (i: number): number => fontSizePxAt?.(i) ?? fontSizePx;
  const glyphs: BreakGlyph[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const cp = ch.codePointAt(0)!;
    const hardBreak = isLinebreak(cp);
    // Tab and the linebreaks take their own branches, so this is only the "no font has a glyph"
    // case (`text_server_adv.cpp:6842-6907`).
    const isControl = !hardBreak && !isTabChar(ch) && isControlChar(cp);
    let advance: number;
    let controlCodepoint: number | undefined;
    if (hardBreak || cp === 0x200b) {
      // A break grapheme and U+200B carry no advance in Godot; the baked
      // charset has no entry for either, so the metrics fallback would give
      // them an average-width one that the overflow test then spends on a
      // spurious wrap.
      advance = 0;
    } else if (isControl) {
      if (preserveControl) {
        advance = hexCodeBoxAdvanceSize(sizeAt(i), cp).x;
        controlCodepoint = cp;
      } else {
        // Without `preserve_invalid` or `preserve_control`, no `Glyph` is pushed
        // (`text_server_adv.cpp:6844`): zero width.
        advance = 0;
      }
    } else {
      advance = glyphAdvancePx(ch, sizeAt(i), metrics);
    }
    glyphs.push({
      start: i,
      end: i + 1,
      advance,
      isSpace: isWhitespace(cp),
      isHardBreak: hardBreak,
      isTab: isTabChar(ch),
      controlCodepoint,
    });
  }
  // Kerning folds into the leading advance, skipped across a size boundary, before the whole-pixel
  // round: a GPOS pair is already inside HarfBuzz's `x_advance` when `text_server_adv.cpp:7077`
  // reads it. Where HarfBuzz quantises the pair is not pinned, as the vendored font has no kerning.
  for (let i = 0; i + 1 < text.length; i++) {
    const sizeI = sizeAt(i);
    if (sizeI !== sizeAt(i + 1)) continue;
    glyphs[i]!.advance += kerningAdjustmentPx(text[i]!, text[i + 1]!, sizeI, metrics);
  }
  roundAdvancesToWholePixels(glyphs, text, sizeAt);
  glyphs.push({ start: text.length, end: text.length + 1, advance: 0, isSpace: true, isHardBreak: false, isTab: false });
  return glyphs;
}

/**
 * Above the subpixel threshold Godot rounds each advance to a whole pixel and carries the remainder
 * (`text_server_adv.cpp:7079-7084`; `keep_rounding_remainders` defaults to true,
 * `text_server_adv.h:344,618`), so each prefix sum stays within half a pixel. Mutates `glyphs`.
 */
function roundAdvancesToWholePixels(
  glyphs: BreakGlyph[],
  text: string,
  sizeAt: (charIndex: number) => number
): void {
  let advanceRemainder = 0;
  for (let i = 0; i < text.length; i++) {
    const sizePx = sizeAt(i);
    // `adv_rem` is local to `_shape_run` (`:7011`), so a size change starts a new run at zero.
    if (i > 0 && sizePx !== sizeAt(i - 1)) advanceRemainder = 0;
    if (fontUsesSubpixelPositioning(sizePx)) continue;
    const cp = text[i]!.codePointAt(0)!;
    // Resets on a tab, a `u_isblank()` character or a break (`:7057`), so a word's error stays in it.
    if (cp === 0x0009 || isSpaceSeparator(cp) || isLinebreak(cp)) advanceRemainder = 0;
    const fullAdvance = advanceRemainder + glyphs[i]!.advance;
    const rounded = godotRound(fullAdvance);
    glyphs[i]!.advance = rounded;
    advanceRemainder = fullAdvance - rounded;
  }
}

/**
 * Port of the scalar-width `TextServer::shaped_text_get_line_breaks`. Returns `[start, end)` ranges,
 * one per line, trimmed of edge spaces. The trim narrows only the emitted range: the width check
 * still counts the trimmed space.
 */
function shapedTextGetLineBreaks(
  glyphs: BreakGlyph[],
  width: number,
  flags: BreakFlags,
  trim: { start: boolean; end: boolean },
  trimIndent = false
): Array<[number, number]> {
  const lSize = glyphs.length;
  const rangeEnd = lSize > 0 ? glyphs[lSize - 1]!.end : 0;

  // BREAK_TRIM_INDENT (`text_server.cpp:1048-1062`): the leading tab/space run,
  // restarted whenever it alone would overrun the box, then capped at 0.6 of it.
  let indent = 0;
  let indentEnd = 0;
  if (trimIndent) {
    for (let i = 0; i < lSize; i++) {
      const g = glyphs[i]!;
      if (!g.isTab && !g.isSpace) break;
      if (indent + g.advance > width) indent = 0;
      indent += g.advance;
      indentEnd = g.end;
    }
    indent = Math.min(indent, 0.6 * width);
  }
  // `l_width` (`:1064`): `width` until a row past the indent starts, then the narrowed width. Each
  // emitted line re-evaluates it.
  let lWidth = width;
  const narrowAfterBreak = (i: number): void => {
    if (width > indent && i > indentEnd) lWidth = width - indent;
  };

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
    if (lWidth > 0 && width_ + adv > lWidth && lastSafeBreak >= 0) {
      const curSafeBrk = lastSafeBreak;

      // BREAK_TRIM_START_EDGE_SPACES and BREAK_TRIM_END_EDGE_SPACES walk start and end off edge spaces.
      let startPos = prevSafeBreak;
      let endPos = lastSafeBreak;
      while (trim.start && trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (trim.end && startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        narrowAfterBreak(i);
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

    // BREAK_MANDATORY is always on, whatever the autowrap mode.
    if (g.isHardBreak) {
      const curSafeBrk = i;
      let startPos = prevSafeBreak;
      let endPos = i;
      while (trim.start && trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (trim.end && startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        narrowAfterBreak(i);
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

    // `i >= indent_end` (`text_server.cpp:1169`): a soft break inside the
    // leading indent is not a candidate, so the indent never becomes a row.
    if (flags.wordBound && g.isSpace && i >= indentEnd) {
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
        while (trim.start && trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
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

/** `String::chr(0x200B)`, the per-paragraph terminator `Label::_shape` appends (`label.cpp:164`). */
const PARAGRAPH_TERMINATOR = '\u200b';

interface ShapedParagraph {
  text: string;
  /** Index of this paragraph's first character in the whole (post-uppercase) text. */
  offset: number;
  terminated: boolean;
}

/**
 * `txt.split(ps)` (`label.cpp:159`) keeps empty entries, so a run of separators is a run of blank
 * lines. With no separator the text is one unterminated paragraph, as Label3D
 * (`label_3d.cpp:485,530`) and `TextParagraph` shape it, where a blank line collapses.
 */
function splitParagraphs(text: string, separator: string | undefined): ShapedParagraph[] {
  if (separator === undefined || separator === '') {
    return [{ text, offset: 0, terminated: false }];
  }
  const out: ShapedParagraph[] = [];
  let offset = 0;
  for (const part of text.split(separator)) {
    out.push({ text: part, offset, terminated: true });
    offset += part.length + separator.length;
  }
  return out;
}

/** Shapes `text` into lines and per-glyph placements at `options.fontSizePx`, against `options.fontMetrics` (default `OPEN_SANS_FONT_METRICS`). */
export function shapeText(text: string, options: ShapeTextOptions): TextLayoutResult {
  const {
    fontSizePx,
    boxWidthPx,
    autowrapMode,
    uppercase = false,
    lineSpacingPx,
    fontSizePxAt,
    fontMetrics = OPEN_SANS_FONT_METRICS,
    paragraphSeparator,
    tabStopsPx,
    autowrapTrimFlags,
    trimIndent = false,
    preserveControl = false,
  } = options;
  const hasTabStops = !!tabStopsPx && tabStopsPx.length > 0;
  // Uppercase before indices are assigned, so a `fontSizePxAt` keyed on the transformed text lines up.
  const transformed = uppercase ? text.toUpperCase() : text;
  const flags = breakFlagsForAutowrap(autowrapMode);
  const trim = {
    start: autowrapTrimFlags === undefined ? true : (autowrapTrimFlags & BREAK_TRIM_START_EDGE_SPACES) !== 0,
    end: autowrapTrimFlags === undefined ? true : (autowrapTrimFlags & BREAK_TRIM_END_EDGE_SPACES) !== 0,
  };
  // AUTOWRAP_OFF never soft-wraps: force an unconstrained width regardless of
  // what the caller passed, so only the always-on hard-break branch can
  // start a new line (mirrors Label::_shape() never OR-ing a wrap flag in).
  const effectiveWidth = autowrapMode === AutowrapMode.OFF ? 0 : boxWidthPx;

  const linePitchPx = getFontLinePitchPx(fontMetrics, fontSizePx, lineSpacingPx);

  // Atlas bitmaps exist only for the font `openSansAtlas.ts` bakes.
  const isAtlasFont = fontMetrics.kind === 'atlas';

  const lines: TextLineLayout[] = [];
  for (const para of splitParagraphs(transformed, paragraphSeparator)) {
    // The terminator is in the shaped text but not the source, so `fontSizePxAt`, keyed into the
    // whole text, is offset back, and the index past the paragraph's end takes its last size.
    const sizeAt = fontSizePxAt
      ? (i: number): number => fontSizePxAt(para.offset + Math.max(0, Math.min(i, para.text.length - 1)))
      : undefined;
    const paraText = para.terminated ? para.text + PARAGRAPH_TERMINATOR : para.text;
    const breakGlyphs = toBreakGlyphs(paraText, fontSizePx, fontMetrics, sizeAt, preserveControl);
    // First tab pass: the aligned advance must be in place before line breaking measures it.
    if (hasTabStops) {
      const paragraphEntries = Array.from(paraText, (char, i) => ({ char, advance: breakGlyphs[i]!.advance }));
      const aligned = tabAlignAdvances(paragraphEntries, tabStopsPx!);
      for (let i = 0; i < aligned.length; i++) breakGlyphs[i]!.advance = aligned[i]!;
    }
    for (const [start, end] of shapedTextGetLineBreaks(breakGlyphs, effectiveWidth, flags, trim, trimIndent)) {
      const clampedEnd = Math.min(end, paraText.length);
      // Second tab pass: restarts the tab-stop cycle at this line's pen origin.
      const lineAdvances = hasTabStops
        ? tabAlignAdvances(
            Array.from({ length: clampedEnd - start }, (_v, i) => ({
              char: paraText[start + i]!,
              advance: breakGlyphs[start + i]!.advance,
            })),
            tabStopsPx!
          )
        : null;
      let penX = 0;
      const glyphs: GlyphPlacement[] = [];
      for (let idx = start; idx < clampedEnd; idx++) {
        const ch = paraText[idx]!;
        const advance = lineAdvances ? lineAdvances[idx - start]! : breakGlyphs[idx]!.advance;
        glyphs.push({
          char: ch,
          x: penX,
          advance,
          glyph: isAtlasFont ? (OPEN_SANS_ATLAS_GLYPHS[ch] ?? null) : null,
          controlCodepoint: breakGlyphs[idx]!.controlCodepoint,
        });
        penX += advance;
      }
      lines.push({ text: paraText.slice(start, clampedEnd), glyphs, widthPx: penX });
    }
  }

  const widthPx = lines.reduce((max, l) => Math.max(max, l.widthPx), 0);
  const heightPx = lines.length * linePitchPx;
  const baselineOffsetPx = getFontAscentPx(fontMetrics, fontSizePx);

  return { lines, linePitchPx, widthPx, heightPx, baselineOffsetPx, fontMetrics };
}
