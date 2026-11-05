/**
 * Overrun trimming for one broken `TextLineLayout`: a port of
 * `TextServer::shaped_text_overrun_trim_to_width`, with one span and one font per line and no
 * per-glyph font fallback search. A right-to-left line cuts at its visual left.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { OPEN_SANS_ATLAS_GLYPHS } from './openSansAtlas';
import {
  firstFaceWithGlyph,
  getFontEmboldenedAdvancePx,
  getFontEmboldenGrowthPx,
  type FontMetrics,
} from './fontMetrics';
import {
  isWhitespace,
  widestLineWidthPx,
  type GlyphPlacement,
  type TextLayoutResult,
  type TextLineLayout,
} from './textLayout';
import { fitTrimmedGlyphsToWidth } from './textJustify';
import { OverrunBehavior } from '../../../../godot/text/textServerEnums';

/**
 * The `TextServer::TextOverrunFlag` bits an `OverrunBehavior` reaches (`text_server.cpp:2399-2432`),
 * without `OVERRUN_SHORT_STRING_ELLIPSIS`, which that mapping never sets, and without
 * `OVERRUN_JUSTIFICATION_AWARE`, which only Label's autowrap-off FILL re-trim sets (`label.cpp:323`).
 */
export interface OverrunTrimFlags {
  trim: boolean;
  trimWordOnly: boolean;
  addEllipsis: boolean;
  enforceEllipsis: boolean;
}

const NO_TRIM_FLAGS: OverrunTrimFlags = {
  trim: false,
  trimWordOnly: false,
  addEllipsis: false,
  enforceEllipsis: false,
};

/** `TextServer::get_overrun_flags_from_behavior` (`text_server.cpp:2399-2432`). */
export function overrunFlagsForBehavior(behavior: number): OverrunTrimFlags {
  switch (behavior) {
    case OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS_FORCE:
      return {
        trim: true,
        trimWordOnly: true,
        addEllipsis: true,
        enforceEllipsis: true,
      };
    case OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE:
      return {
        trim: true,
        trimWordOnly: false,
        addEllipsis: true,
        enforceEllipsis: true,
      };
    case OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS:
      return {
        trim: true,
        trimWordOnly: true,
        addEllipsis: true,
        enforceEllipsis: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_ELLIPSIS:
      return {
        trim: true,
        trimWordOnly: false,
        addEllipsis: true,
        enforceEllipsis: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_WORD:
      return {
        trim: true,
        trimWordOnly: true,
        addEllipsis: false,
        enforceEllipsis: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_CHAR:
      return {
        trim: true,
        trimWordOnly: false,
        addEllipsis: false,
        enforceEllipsis: false,
      };
    case OverrunBehavior.OVERRUN_NO_TRIMMING:
    default:
      return NO_TRIM_FLAGS;
  }
}

/** The default ellipsis every caller falls back to, `String::chr(0x2026)` (`label.cpp:294` et al.'s `(el_char.length() > 0) ? el_char[0] : 0x2026`). */
const DEFAULT_ELLIPSIS_CHAR = '…';

/** `ell_min_characters` (`text_server_adv.cpp:6049`): below this many kept characters, a plain cut replaces the ellipsis. */
const ELL_MIN_CHARACTERS = 6;

interface OverrunTrimOptions {
  fontMetrics: FontMetrics;
  /** The font size of the last glyph, which Godot reads (`text_server_adv.cpp:5981`): the line size, or its trailing run size. */
  fontSizePx: number;
  /** `Label.ellipsis_char` / `TextParagraph.ellipsis_char`; defaults to `DEFAULT_ELLIPSIS_CHAR`. */
  ellipsisChar?: string;
}

interface TextBufferTrimOptions extends OverrunTrimOptions {
  /**
   * The set direction is RTL: `shaped_text_draw` reads `shaped_text_get_direction`
   * (`text_server.cpp:1744`), so only an RTL line of AUTO direction draws its fill left to right.
   */
  isDrawnRtl: boolean;
}

/** Where the trim loop stopped: the cut position and the ellipsis position, -1 for none. */
interface TrimCut {
  trimPos: number;
  ellipsisPos: number;
  /** The loop's `width` where it stopped: the advance it keeps, without the ellipsis. */
  keptWidthPx: number;
}

interface TrimBudget {
  widthPx: number;
  flags: OverrunTrimFlags;
  ellipsisWidthPx: number;
}

/**
 * The face that draws `ch` past the cut (`text_server_adv.cpp:5984-6036`): the last glyph's, else the
 * first font of the span's **Fallback chain** that has it. Null for none.
 */
function faceWithGlyph(lastFace: FontMetrics, spanFace: FontMetrics, ch: string): FontMetrics | null {
  return lastFace.hasGlyph(ch) ? lastFace : firstFaceWithGlyph(spanFace, ch);
}

function atlasGlyphFor(fontMetrics: FontMetrics, ch: string) {
  return fontMetrics.kind === 'atlas' ? (OPEN_SANS_ATLAS_GLYPHS[ch] ?? null) : null;
}

/** `GRAPHEME_IS_BREAK_SOFT` reduces to "is a space glyph" for this engine's ASCII/Latin word-bound rule (`textLayout.ts`'s own doc). */
function isSoftBreakGlyph(gp: GlyphPlacement): boolean {
  return isWhitespace(gp.char.codePointAt(0)!);
}

/** A trim the loop found: the cut, and the ellipsis glyphs in logical order. */
interface OverrunTrim {
  cut: TrimCut;
  ellipsis: Array<Omit<GlyphPlacement, 'x'>>;
  /** `int ellipsis_width` (`:6044-6046`). */
  ellipsisWidthPx: number;
}

/**
 * Port of `TextServer::shaped_text_overrun_trim_to_width` (`text_server_adv.cpp:5935-6154`), drawn
 * in the paragraph's inferred direction (`line.isRtl`, `sd->para_direction` at `:6053`), as Label
 * draws it (`label.h:198-241`) and as `shaped_text_draw_outline` draws every text buffer. Returns
 * `line` unchanged when nothing needs trimming (`:5958-5966`), else a new layout whose glyphs,
 * text and `widthPx` include the cut and any ellipsis.
 */
export function trimLineToWidth(
  line: TextLineLayout,
  widthPx: number,
  flags: OverrunTrimFlags,
  options: OverrunTrimOptions
): TextLineLayout {
  const trim = findOverrunTrim(line, widthPx, flags, options);
  if (!trim) return line;
  return trimmedLine(line, trim, inferredDirectionGlyphs(line, line.glyphs, trim));
}

interface FilledTrimOptions extends OverrunTrimOptions {
  /** The Label's `justification_flags`, which the fit after the trim reads (`label.cpp:325`). */
  justificationFlags: number;
}

/**
 * {@link trimLineToWidth} for a line of a FILL Label with autowrap off, which `_shape` fits, trims and
 * fits again with `JUSTIFICATION_CONSTRAIN_ELLIPSIS` (`label.cpp:322-325`). The second fit grows the
 * spaces the cut keeps until the kept glyphs and the ellipsis reach `widthPx`. A line the trim
 * enforces an ellipsis on without cutting keeps its glyphs (`text_server_adv.cpp:5582`).
 */
export function trimFilledLineToWidth(
  line: TextLineLayout,
  widthPx: number,
  flags: OverrunTrimFlags,
  options: FilledTrimOptions
): TextLineLayout {
  const trim = findOverrunTrim(line, widthPx, flags, options);
  if (!trim) return line;
  const { trimPos } = trim.cut;
  const glyphs =
    trimPos < 0
      ? line.glyphs
      : fitTrimmedGlyphsToWidth(
          line,
          { trimPos, trimmedWidthPx: trimmedWidthPx(trim) },
          widthPx,
          options.justificationFlags,
          options.fontSizePx
        );
  return trimmedLine(line, trim, inferredDirectionGlyphs(line, glyphs, trim));
}

/**
 * The same trim as a `TextLine` or `TextParagraph` draws it. The fill reads the set direction
 * (`text_server.cpp:1744`). An AUTO line that infers RTL draws the glyphs before the cut from the
 * visual left, stops at the first that crosses the width (`:1781-1786`), then draws the ellipsis.
 * The outline reads the inferred direction (`:1840`), so that line puts it in `outlineGlyphs`.
 */
export function trimTextBufferLineToWidth(
  line: TextLineLayout,
  widthPx: number,
  flags: OverrunTrimFlags,
  options: TextBufferTrimOptions
): TextLineLayout {
  const trim = findOverrunTrim(line, widthPx, flags, options);
  if (!trim) return line;
  const outline = trimmedLine(line, trim, inferredDirectionGlyphs(line, line.glyphs, trim));
  if (!line.isRtl || options.isDrawnRtl) return outline;
  return {
    ...outline,
    glyphs: leftToRightClippedGlyphs(line.glyphs, trim, widthPx),
    outlineGlyphs: outline.glyphs,
  };
}

/** The cut and ellipsis of `line` at `widthPx`, or null when Godot leaves the line whole (`:5958`, `:6122`). */
function findOverrunTrim(
  line: TextLineLayout,
  widthPx: number,
  flags: OverrunTrimFlags,
  options: OverrunTrimOptions
): OverrunTrim | null {
  const { fontMetrics, fontSizePx, ellipsisChar = DEFAULT_ELLIPSIS_CHAR } = options;
  const glyphs = line.glyphs;

  // :5958
  if (
    !flags.trim ||
    glyphs.length === 0 ||
    widthPx <= 0 ||
    !(line.widthPx > widthPx || flags.enforceEllipsis)
  ) {
    return null;
  }

  // :5985-6046
  const lastFace = glyphs.at(-1)!.fontMetrics;
  const wantsEllipsis = flags.addEllipsis || flags.enforceEllipsis;
  const elFace = wantsEllipsis ? faceWithGlyph(lastFace, fontMetrics, ellipsisChar) : lastFace;
  const foundElChar = elFace !== null;
  const dotChar = foundElChar ? ellipsisChar : '.';
  const dotRepeat = foundElChar ? 1 : 3;
  const dotFace = elFace ?? faceWithGlyph(lastFace, fontMetrics, '.') ?? lastFace;
  const whitespaceFace = faceWithGlyph(lastFace, fontMetrics, ' ') ?? lastFace;
  const dotAdvancePx = wantsEllipsis ? getFontEmboldenedAdvancePx(dotFace, dotChar, fontSizePx) : 0;
  const whitespaceAdvancePx = getFontEmboldenedAdvancePx(whitespaceFace, ' ', fontSizePx);
  const emboldenGrowthPx = getFontEmboldenGrowthPx(dotFace.embolden ?? 0, fontSizePx) || undefined;
  // :6044-6046 -- `int ellipsis_width` truncates.
  const ellipsisWidthPx = flags.addEllipsis
    ? Math.trunc(dotRepeat * dotAdvancePx + (flags.trimWordOnly ? whitespaceAdvancePx : 0))
    : 0;

  const budget: TrimBudget = { widthPx, flags, ellipsisWidthPx };
  // `sd->para_direction == DIRECTION_RTL` (`:6053`): the cut walks from the visual left.
  const cut = findCut(glyphs, line.widthPx, budget, line.isRtl === true);

  // :6122
  if (!((cut.trimPos >= 0 && line.widthPx > widthPx) || flags.enforceEllipsis)) {
    return null;
  }

  // :6123-6149: the space a word cut adds, then the dots, in logical order.
  const ellipsis: Array<Omit<GlyphPlacement, 'x'>> = [];
  if (flags.addEllipsis && (cut.ellipsisPos > 0 || flags.enforceEllipsis)) {
    if (flags.trimWordOnly && cut.ellipsisPos > 0) {
      ellipsis.push({
        char: ' ',
        advance: whitespaceAdvancePx,
        glyph: atlasGlyphFor(whitespaceFace, ' '),
        fontSizePx,
        fontMetrics: whitespaceFace,
      });
    }
    for (let r = 0; r < dotRepeat; r++) {
      ellipsis.push({
        char: dotChar,
        advance: dotAdvancePx,
        glyph: atlasGlyphFor(dotFace, dotChar),
        emboldenGrowthPx,
        fontSizePx,
        fontMetrics: dotFace,
      });
    }
  }
  return { cut, ellipsis, ellipsisWidthPx };
}

/**
 * The `glyphs` of `line` the trim keeps, drawn in its inferred direction. `trim_pos < 0` draws every
 * glyph uncut (`text_server.cpp:1768-1777`): only `enforceEllipsis` on a line that fits reaches
 * it. An RTL line draws its ellipsis first, reversed (`:1752-1763`).
 */
function inferredDirectionGlyphs(
  line: TextLineLayout,
  glyphs: readonly GlyphPlacement[],
  { cut, ellipsis }: OverrunTrim
): GlyphPlacement[] {
  const { trimPos } = cut;
  if (line.isRtl) {
    return placeFrom(0, [...[...ellipsis].reverse(), ...(trimPos < 0 ? glyphs : glyphs.slice(trimPos))]);
  }
  return keptWithEllipsis(trimPos < 0 ? glyphs : glyphs.slice(0, trimPos), ellipsis);
}

/**
 * `shaped_text_draw` in a left-to-right set direction: the glyphs before `trimPos`, cut at the first
 * that ends past `clipRightPx` with no ellipsis after it (`text_server.cpp:1779-1786`), else
 * followed by the ellipsis.
 */
function leftToRightClippedGlyphs(
  glyphs: readonly GlyphPlacement[],
  { cut, ellipsis }: OverrunTrim,
  clipRightPx: number
): GlyphPlacement[] {
  const drawn = cut.trimPos < 0 ? glyphs : glyphs.slice(0, cut.trimPos);
  const clipAt = drawn.findIndex((glyph) => glyph.x + glyph.advance > clipRightPx);
  if (clipAt >= 0) return drawn.slice(0, clipAt);
  return keptWithEllipsis(drawn, ellipsis);
}

/** `width_trimmed` (`:6152`), which alignment reads: the kept advance and the truncated ellipsis width, which both draws place by. */
function trimmedWidthPx({ cut, ellipsisWidthPx }: OverrunTrim): number {
  return cut.keptWidthPx + (cut.ellipsisPos !== -1 ? ellipsisWidthPx : 0);
}

/** `line` with `glyphs` in place of its own. */
function trimmedLine(line: TextLineLayout, trim: OverrunTrim, glyphs: GlyphPlacement[]): TextLineLayout {
  return {
    text: line.text,
    glyphs,
    widthPx: trimmedWidthPx(trim),
    paragraphIndex: line.paragraphIndex,
    paragraphStart: line.paragraphStart,
    isRtl: line.isRtl,
  };
}

/**
 * Each row of `layout` trimmed by {@link trimTextBufferLineToWidth}, as `TextParagraph::_shape_lines`
 * trims an unwrapped buffer (`text_paragraph.cpp:282-293`). Its width is the widest trimmed row.
 */
export function trimLayoutToWidth(
  layout: TextLayoutResult,
  widthPx: number,
  flags: OverrunTrimFlags,
  options: TextBufferTrimOptions
): TextLayoutResult {
  const lines = layout.lines.map((line) => trimTextBufferLineToWidth(line, widthPx, flags, options));
  return { ...layout, lines, widthPx: widestLineWidthPx(lines) };
}

/** The right edge of the last placed glyph. */
function drawnWidthPx(glyphs: readonly GlyphPlacement[]): number {
  const last = glyphs.at(-1);
  return last ? last.x + last.advance : 0;
}

/** `glyphs` laid out from `penX`, each at the end of the one on its left. */
function placeFrom(penX: number, glyphs: ReadonlyArray<Omit<GlyphPlacement, 'x'>>): GlyphPlacement[] {
  return glyphs.map((glyph) => {
    const placed = { ...glyph, x: penX };
    penX += glyph.advance;
    return placed;
  });
}

/** The kept glyphs of a left-to-right line, already at x 0 onward, then the ellipsis after them. */
function keptWithEllipsis(
  kept: readonly GlyphPlacement[],
  ellipsis: ReadonlyArray<Omit<GlyphPlacement, 'x'>>
): GlyphPlacement[] {
  return [...kept, ...placeFrom(drawnWidthPx(kept), ellipsis)];
}

/** Whether the trim may cut at `glyph`: anywhere, or only at a soft break for a word trim past the minimum. */
function isCutAllowed(
  glyph: GlyphPlacement,
  flags: OverrunTrimFlags,
  isAboveMinCharThreshold: boolean
): boolean {
  return !(flags.trimWordOnly && isAboveMinCharThreshold) || isSoftBreakGlyph(glyph);
}

/** The ellipsis width the cut must leave room for at a glyph on either side of the minimum. */
function ellipsisBudgetPx(budget: TrimBudget, isAboveMinCharThreshold: boolean): number {
  const { flags, ellipsisWidthPx } = budget;
  return (isAboveMinCharThreshold && flags.addEllipsis) || flags.enforceEllipsis ? ellipsisWidthPx : 0;
}

/**
 * `:6048-6120`. A left-to-right line walks from the visual right and subtracts each glyph before it
 * tests the cut, so `trimPos` keeps `[0, trimPos)`. A right-to-left line walks from the visual left
 * and subtracts after the test, so `trimPos` keeps `[trimPos, length)`, the logical start.
 */
function findCut(
  glyphs: readonly GlyphPlacement[],
  lineWidthPx: number,
  budget: TrimBudget,
  isParagraphRtl: boolean
): TrimCut {
  const { widthPx, flags, ellipsisWidthPx } = budget;
  const length = glyphs.length;
  if (flags.enforceEllipsis && lineWidthPx + ellipsisWidthPx <= widthPx) {
    return { trimPos: -1, ellipsisPos: isParagraphRtl ? 0 : length, keptWidthPx: lineWidthPx };
  }
  let width = lineWidthPx;
  let trimPos = isParagraphRtl ? length : 0;
  let ellipsisPos = flags.enforceEllipsis ? 0 : -1;
  // `last_valid_cut_witout_el` and its width: the last position that fit without the ellipsis
  // budget, for the min-characters fallback.
  let lastValidCutWithoutEl = -1;
  let widthWithoutElPx = width;
  const step = isParagraphRtl ? 1 : -1;
  // `glyphs_to` is `sd_size - 1` for RTL (`:6062`), so the cut never keeps the last glyph alone.
  const stopAt = isParagraphRtl ? length - 1 : -1;
  for (let i = isParagraphRtl ? 0 : length - 1; i !== stopAt; i += step) {
    const glyph = glyphs[i]!;
    if (!isParagraphRtl) width -= glyph.advance;
    const isAboveMinCharThreshold = (isParagraphRtl ? length - 1 - i : i) >= ELL_MIN_CHARACTERS;
    if (!isAboveMinCharThreshold && lastValidCutWithoutEl !== -1) {
      trimPos = lastValidCutWithoutEl;
      ellipsisPos = -1;
      width = widthWithoutElPx;
      break;
    }
    const isAllowed = isCutAllowed(glyph, flags, isAboveMinCharThreshold);
    if (!flags.enforceEllipsis && width <= widthPx && lastValidCutWithoutEl === -1 && isAllowed) {
      lastValidCutWithoutEl = i;
      widthWithoutElPx = width;
    }
    if (width + ellipsisBudgetPx(budget, isAboveMinCharThreshold) <= widthPx && isAllowed) {
      const fitsEllipsis =
        flags.addEllipsis &&
        (isAboveMinCharThreshold || flags.enforceEllipsis) &&
        width - ellipsisWidthPx <= widthPx;
      trimPos = i;
      if (fitsEllipsis) ellipsisPos = i;
      break;
    }
    if (isParagraphRtl) width -= glyph.advance;
  }
  return withEnforcedEllipsisAtStart({ trimPos, ellipsisPos, keptWidthPx: width }, flags);
}

/** `:6118-6120`: an enforced ellipsis on a line cut to nothing still draws. */
function withEnforcedEllipsisAtStart(cut: TrimCut, flags: OverrunTrimFlags): TrimCut {
  return cut.trimPos === 0 && flags.enforceEllipsis && flags.addEllipsis ? { ...cut, ellipsisPos: 0 } : cut;
}
