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
import { getFontEmboldenedAdvancePx, getFontEmboldenGrowthPx, type FontMetrics } from './fontMetrics';
import { isWhitespace, type GlyphPlacement, type TextLineLayout } from './textLayout';
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
  /**
   * `shaped_text_get_direction == DIRECTION_RTL` in `shaped_text_draw` (`text_server.cpp`), which reads
   * the set direction. Defaults to the line's inferred direction, as Label's own `draw_text` reads it.
   * An AUTO `TextParagraph` line that infers RTL passes false: it draws the glyphs left of the cut.
   */
  isDrawnRtl?: boolean;
}

/** Where the trim loop stopped: the cut position and the ellipsis position, -1 for none. */
interface TrimCut {
  trimPos: number;
  ellipsisPos: number;
}

interface TrimBudget {
  widthPx: number;
  flags: OverrunTrimFlags;
  ellipsisWidthPx: number;
}

/** Whether the font has a glyph for `ch`, as `_font_has_char` (`text_server_adv.cpp:5985`) asks: no advance of its own means none (`FontMetrics.getGlyphAdvanceUnits`), for every font kind. */
function hasGlyphInk(fontMetrics: FontMetrics, ch: string): boolean {
  return fontMetrics.getGlyphAdvanceUnits(ch) !== null;
}

function atlasGlyphFor(fontMetrics: FontMetrics, ch: string) {
  return fontMetrics.kind === 'atlas' ? (OPEN_SANS_ATLAS_GLYPHS[ch] ?? null) : null;
}

/** `GRAPHEME_IS_BREAK_SOFT` reduces to "is a space glyph" for this engine's ASCII/Latin word-bound rule (`textLayout.ts`'s own doc). */
function isSoftBreakGlyph(gp: GlyphPlacement): boolean {
  return isWhitespace(gp.char.codePointAt(0)!);
}

/**
 * Port of `TextServer::shaped_text_overrun_trim_to_width` (`text_server_adv.cpp:5935-6154`). Returns
 * `line` unchanged when nothing needs trimming (`:5958-5966`), else a new layout whose glyphs, text
 * and `widthPx` include the cut and any ellipsis.
 */
export function trimLineToWidth(
  line: TextLineLayout,
  widthPx: number,
  flags: OverrunTrimFlags,
  options: OverrunTrimOptions
): TextLineLayout {
  const { fontMetrics, fontSizePx, ellipsisChar = DEFAULT_ELLIPSIS_CHAR } = options;
  const glyphs = line.glyphs;

  // :5958
  if (
    !flags.trim ||
    glyphs.length === 0 ||
    widthPx <= 0 ||
    !(line.widthPx > widthPx || flags.enforceEllipsis)
  ) {
    return line;
  }

  // :5985-6046, without the span and fallback-font search: one font per line here.
  const foundElChar =
    flags.addEllipsis || flags.enforceEllipsis ? hasGlyphInk(fontMetrics, ellipsisChar) : true;
  const dotChar = foundElChar ? ellipsisChar : '.';
  const dotRepeat = foundElChar ? 1 : 3;
  const dotAdvancePx =
    flags.addEllipsis || flags.enforceEllipsis
      ? getFontEmboldenedAdvancePx(fontMetrics, dotChar, fontSizePx)
      : 0;
  const whitespaceAdvancePx = getFontEmboldenedAdvancePx(fontMetrics, ' ', fontSizePx);
  const emboldenGrowthPx = getFontEmboldenGrowthPx(fontMetrics.embolden ?? 0, fontSizePx) || undefined;
  // :6044-6046 -- `int ellipsis_width` truncates.
  const ellipsisWidthPx = flags.addEllipsis
    ? Math.trunc(dotRepeat * dotAdvancePx + (flags.trimWordOnly ? whitespaceAdvancePx : 0))
    : 0;

  const budget: TrimBudget = { widthPx, flags, ellipsisWidthPx };
  // `sd->para_direction == DIRECTION_RTL` (`:6053`): the cut walks from the visual left.
  const isRtl = line.isRtl === true;
  const { trimPos, ellipsisPos } = findCut(glyphs, line.widthPx, budget, isRtl);

  // :6122
  if (!((trimPos >= 0 && line.widthPx > widthPx) || flags.enforceEllipsis)) {
    return line;
  }

  // :6123-6149: the space a word cut adds, then the dots, in logical order.
  const ellipsis: Array<Omit<GlyphPlacement, 'x'>> = [];
  if (flags.addEllipsis && (ellipsisPos > 0 || flags.enforceEllipsis)) {
    if (flags.trimWordOnly && ellipsisPos > 0) {
      ellipsis.push({ char: ' ', advance: whitespaceAdvancePx, glyph: atlasGlyphFor(fontMetrics, ' ') });
    }
    for (let r = 0; r < dotRepeat; r++) {
      ellipsis.push({
        char: dotChar,
        advance: dotAdvancePx,
        glyph: atlasGlyphFor(fontMetrics, dotChar),
        emboldenGrowthPx,
      });
    }
  }

  // `trim_pos < 0` draws every glyph uncut (`text_server.cpp:1768-1777`): only `enforceEllipsis` on a
  // line that fits reaches it. `draw_text` puts an RTL line's ellipsis first, its glyphs reversed (`label.h:200-210`).
  const isDrawnRtl = options.isDrawnRtl ?? isRtl;
  const finalGlyphs = isDrawnRtl
    ? placeFrom(0, [...[...ellipsis].reverse(), ...(trimPos < 0 ? glyphs : glyphs.slice(trimPos))])
    : keptWithEllipsis(trimPos < 0 ? glyphs : glyphs.slice(0, trimPos), ellipsis);
  return {
    text: line.text,
    glyphs: finalGlyphs,
    // `width_trimmed` (`:6152`), which alignment reads: the kept glyphs plus the ellipsis. It differs
    // from the drawn width only for an AUTO line that infers RTL, which keeps one part and draws the other.
    widthPx: isRtl
      ? advanceSumPx(glyphs, Math.max(0, trimPos)) + advanceSumPx(ellipsis, 0)
      : drawnWidthPx(finalGlyphs),
    paragraphIndex: line.paragraphIndex,
    paragraphStart: line.paragraphStart,
    isRtl: line.isRtl,
  };
}

/** The summed advance of `glyphs` from index `from` on. */
function advanceSumPx(glyphs: ReadonlyArray<Pick<GlyphPlacement, 'advance'>>, from: number): number {
  let sum = 0;
  for (let i = from; i < glyphs.length; i++) sum += glyphs[i]!.advance;
  return sum;
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
  isRtl: boolean
): TrimCut {
  const { widthPx, flags, ellipsisWidthPx } = budget;
  const length = glyphs.length;
  if (flags.enforceEllipsis && lineWidthPx + ellipsisWidthPx <= widthPx) {
    return { trimPos: -1, ellipsisPos: isRtl ? 0 : length };
  }
  let width = lineWidthPx;
  let cut: TrimCut = { trimPos: isRtl ? length : 0, ellipsisPos: flags.enforceEllipsis ? 0 : -1 };
  // `last_valid_cut_witout_el`: the last position that fit without the ellipsis budget, for the
  // min-characters fallback. Its width is not carried, since the final width comes from the kept glyphs.
  let lastValidCutWithoutEl = -1;
  const step = isRtl ? 1 : -1;
  // `glyphs_to` is `sd_size - 1` for RTL (`:6062`), so the cut never keeps the last glyph alone.
  const stopAt = isRtl ? length - 1 : -1;
  for (let i = isRtl ? 0 : length - 1; i !== stopAt; i += step) {
    const glyph = glyphs[i]!;
    if (!isRtl) width -= glyph.advance;
    const isAboveMinCharThreshold = (isRtl ? length - 1 - i : i) >= ELL_MIN_CHARACTERS;
    if (!isAboveMinCharThreshold && lastValidCutWithoutEl !== -1) {
      cut = { trimPos: lastValidCutWithoutEl, ellipsisPos: -1 };
      break;
    }
    const isAllowed = isCutAllowed(glyph, flags, isAboveMinCharThreshold);
    if (!flags.enforceEllipsis && width <= widthPx && lastValidCutWithoutEl === -1 && isAllowed) {
      lastValidCutWithoutEl = i;
    }
    if (width + ellipsisBudgetPx(budget, isAboveMinCharThreshold) <= widthPx && isAllowed) {
      const fitsEllipsis =
        flags.addEllipsis &&
        (isAboveMinCharThreshold || flags.enforceEllipsis) &&
        width - ellipsisWidthPx <= widthPx;
      cut = { trimPos: i, ellipsisPos: fitsEllipsis ? i : cut.ellipsisPos };
      break;
    }
    if (isRtl) width -= glyph.advance;
  }
  return withEnforcedEllipsisAtStart(cut, flags);
}

/** `:6118-6120`: an enforced ellipsis on a line cut to nothing still draws. */
function withEnforcedEllipsisAtStart(cut: TrimCut, flags: OverrunTrimFlags): TrimCut {
  return cut.trimPos === 0 && flags.enforceEllipsis && flags.addEllipsis ? { ...cut, ellipsisPos: 0 } : cut;
}
