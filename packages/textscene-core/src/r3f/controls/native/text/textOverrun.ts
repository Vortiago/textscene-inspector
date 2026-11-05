/**
 * Overrun trimming for one broken `TextLineLayout`: a port of
 * `TextServer::shaped_text_overrun_trim_to_width`, with one span and one font per line and no
 * per-glyph font fallback search. A right-to-left paragraph trims its visual start; its glyphs stay
 * in visual order, as no bidi reordering runs here.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { OPEN_SANS_ATLAS_GLYPHS } from './openSansAtlas';
import { getFontEmboldenedAdvancePx, getFontEmboldenGrowthPx, type FontMetrics } from './fontMetrics';
import {
  isWhitespace,
  soloLineLayout,
  type GlyphPlacement,
  type TextLayoutResult,
  type TextLineLayout,
} from './textLayout';
import { OverrunBehavior } from '../../../../godot/text/textServerEnums';

/**
 * The `TextServer::TextOverrunFlag` bits an `OverrunBehavior` reaches (`text_server.cpp:2399-2432`).
 * The two FORCE behaviours set `OVERRUN_SHORT_STRING_ELLIPSIS`, never `OVERRUN_ENFORCE_ELLIPSIS`: a line
 * that fits stays whole, and a short string that overflows still gets its ellipsis. A caller sets
 * `enforceEllipsis` for the lines `TextParagraph` hides (`text_paragraph.cpp:231`) and
 * `justificationAware` for Label's autowrap-off FILL re-trim (`label.cpp:323`).
 */
export interface OverrunTrimFlags {
  trim: boolean;
  trimWordOnly: boolean;
  addEllipsis: boolean;
  enforceEllipsis: boolean;
  shortStringEllipsis: boolean;
  justificationAware: boolean;
}

const NO_TRIM_FLAGS: OverrunTrimFlags = {
  trim: false,
  trimWordOnly: false,
  addEllipsis: false,
  enforceEllipsis: false,
  shortStringEllipsis: false,
  justificationAware: false,
};

/** The properties that make a narrower box cut or trim the text instead of growing (`button.cpp:493-495`, `label.cpp:993-995`). */
export interface TextClipProperties {
  clipText?: boolean;
  overrunBehavior?: number;
}

/** `clip_text` or a trimming overrun behaviour: the text's width no longer sets the minimum size. */
export function isTextWidthClipped(props: TextClipProperties): boolean {
  return (
    props.clipText === true ||
    (props.overrunBehavior ?? OverrunBehavior.OVERRUN_NO_TRIMMING) !== OverrunBehavior.OVERRUN_NO_TRIMMING
  );
}

/** `TextServer::get_overrun_flags_from_behavior` (`text_server.cpp:2399-2432`). */
export function overrunFlagsForBehavior(behavior: number | undefined): OverrunTrimFlags {
  switch (behavior) {
    case OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS_FORCE:
      return {
        trim: true,
        trimWordOnly: true,
        addEllipsis: true,
        enforceEllipsis: false,
        shortStringEllipsis: true,
        justificationAware: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE:
      return {
        trim: true,
        trimWordOnly: false,
        addEllipsis: true,
        enforceEllipsis: false,
        shortStringEllipsis: true,
        justificationAware: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS:
      return {
        trim: true,
        trimWordOnly: true,
        addEllipsis: true,
        enforceEllipsis: false,
        shortStringEllipsis: false,
        justificationAware: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_ELLIPSIS:
      return {
        trim: true,
        trimWordOnly: false,
        addEllipsis: true,
        enforceEllipsis: false,
        shortStringEllipsis: false,
        justificationAware: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_WORD:
      return {
        trim: true,
        trimWordOnly: true,
        addEllipsis: false,
        enforceEllipsis: false,
        shortStringEllipsis: false,
        justificationAware: false,
      };
    case OverrunBehavior.OVERRUN_TRIM_CHAR:
      return {
        trim: true,
        trimWordOnly: false,
        addEllipsis: false,
        enforceEllipsis: false,
        shortStringEllipsis: false,
        justificationAware: false,
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

export interface OverrunTrimOptions {
  fontMetrics: FontMetrics;
  /** The font size of the last glyph, which Godot reads (`text_server_adv.cpp:5981`): the line size, or its trailing run size. */
  fontSizePx: number;
  /** `Label.ellipsis_char` / `TextParagraph.ellipsis_char`; defaults to `DEFAULT_ELLIPSIS_CHAR`. */
  ellipsisChar?: string;
  /** `sd->fit_width_minimum_reached` from a prior `fitLineToWidth`, read only when `flags.justificationAware`. */
  fitWidthMinimumReached?: boolean;
  /** `sd->para_direction == DIRECTION_RTL` (`text_server_adv.cpp:6053`): trim the visual start, not the end. */
  isRtl?: boolean;
}

/** Whether the font has a bitmap for `ch`: the baked charset for `'atlas'` metrics, always true for a `'canvas'` font. */
function hasGlyphInk(fontMetrics: FontMetrics, ch: string): boolean {
  return fontMetrics.kind !== 'atlas' || ch in OPEN_SANS_ATLAS_GLYPHS;
}

function atlasGlyphFor(fontMetrics: FontMetrics, ch: string) {
  return fontMetrics.kind === 'atlas' ? (OPEN_SANS_ATLAS_GLYPHS[ch] ?? null) : null;
}

/** `GRAPHEME_IS_BREAK_SOFT` reduces to "is a space glyph" for this engine's ASCII/Latin word-bound rule (`textLayout.ts`'s own doc). */
function isSoftBreakGlyph(gp: GlyphPlacement): boolean {
  return isWhitespace(gp.char.codePointAt(0)!);
}

/** One glyph of the ellipsis: a space before it under word trim, then each dot. */
interface EllipsisGlyph {
  char: string;
  advance: number;
  emboldenGrowthPx?: number;
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
  const {
    fontMetrics,
    fontSizePx,
    ellipsisChar = DEFAULT_ELLIPSIS_CHAR,
    fitWidthMinimumReached = false,
    isRtl = false,
  } = options;
  const glyphs = line.glyphs;

  // :5958: only `enforceEllipsis` passes a line that fits, never the short-string flag.
  if (
    !flags.trim ||
    glyphs.length === 0 ||
    widthPx <= 0 ||
    !(line.widthPx > widthPx || flags.enforceEllipsis)
  ) {
    return line;
  }
  // :5964-5966
  if (flags.justificationAware && !fitWidthMinimumReached) {
    return line;
  }

  // Every later test reads `enforce_ellipsis || short_string_ellipsis` (`:5995-6154`).
  const alwaysEllipsis = flags.enforceEllipsis || flags.shortStringEllipsis;

  // :5985-6046, without the span and fallback-font search: one font per line here.
  const foundElChar = flags.addEllipsis || alwaysEllipsis ? hasGlyphInk(fontMetrics, ellipsisChar) : true;
  const dotChar = foundElChar ? ellipsisChar : '.';
  const dotRepeat = foundElChar ? 1 : 3;
  const dotAdvancePx =
    flags.addEllipsis || alwaysEllipsis ? getFontEmboldenedAdvancePx(fontMetrics, dotChar, fontSizePx) : 0;
  const whitespaceAdvancePx = getFontEmboldenedAdvancePx(fontMetrics, ' ', fontSizePx);
  const emboldenGrowthPx = getFontEmboldenGrowthPx(fontMetrics.embolden ?? 0, fontSizePx) || undefined;
  // :6044-6046 -- `int ellipsis_width` truncates.
  const ellipsisWidthPx = flags.addEllipsis
    ? Math.trunc(dotRepeat * dotAdvancePx + (flags.trimWordOnly ? whitespaceAdvancePx : 0))
    : 0;

  const { trimPos, ellipsisPos } = findTrimPosition(line, widthPx, flags, {
    ellipsisWidthPx,
    alwaysEllipsis,
    isRtl,
  });

  // :6122
  if (!((trimPos >= 0 && line.widthPx > widthPx) || alwaysEllipsis)) {
    return line;
  }

  // `trim_pos < 0` draws every glyph uncut (`text_server.cpp:1768-1777`): only `enforceEllipsis` on a
  // line that fits reaches it, and draws the ellipsis too.
  const kept = trimPos < 0 ? glyphs : isRtl ? glyphs.slice(trimPos) : glyphs.slice(0, trimPos);
  const keptStartPx = kept.length > 0 ? kept[0]!.x : 0;
  const keptWidthPx =
    kept.length > 0 ? kept[kept.length - 1]!.x + kept[kept.length - 1]!.advance - keptStartPx : 0;

  // :6123-6149. `text_server.cpp:1757-1766` draws a right-to-left ellipsis first, its buffer reversed.
  const ellipsis: EllipsisGlyph[] = [];
  if (flags.addEllipsis && (ellipsisPos > 0 || alwaysEllipsis)) {
    if (flags.trimWordOnly && ellipsisPos > 0) ellipsis.push({ char: ' ', advance: whitespaceAdvancePx });
    for (let r = 0; r < dotRepeat; r++) {
      ellipsis.push({ char: dotChar, advance: dotAdvancePx, emboldenGrowthPx });
    }
  }
  const finalGlyphs = isRtl
    ? [
        ...placeEllipsis(ellipsis.reverse(), 0, fontMetrics),
        ...shiftGlyphs(kept, advanceOf(ellipsis) - keptStartPx),
      ]
    : [...shiftGlyphs(kept, -keptStartPx), ...placeEllipsis(ellipsis, keptWidthPx, fontMetrics)];
  return {
    text: finalGlyphs.map((g) => g.char).join(''),
    glyphs: finalGlyphs,
    // `width_trimmed` (`:6152`): the kept advances plus the whole-pixel `ellipsis_width`, which counts the
    // word-cut space even where `:6126` appends none.
    widthPx: keptWidthPx + (ellipsisPos !== -1 ? ellipsisWidthPx : 0),
  };
}

interface TrimSearch {
  ellipsisWidthPx: number;
  alwaysEllipsis: boolean;
  isRtl: boolean;
}

/**
 * `trim_pos` and `ellipsis_pos` (`text_server_adv.cpp:6055-6120`): the first glyph cut away from the
 * end, or the first glyph kept from the start in a right-to-left paragraph.
 */
function findTrimPosition(
  line: TextLineLayout,
  widthPx: number,
  flags: OverrunTrimFlags,
  { ellipsisWidthPx, alwaysEllipsis, isRtl }: TrimSearch
): { trimPos: number; ellipsisPos: number } {
  const glyphs = line.glyphs;
  const count = glyphs.length;
  let width = line.widthPx;
  let trimPos = isRtl ? count : 0;
  let ellipsisPos = alwaysEllipsis ? 0 : -1;
  // `last_valid_cut_witout_el`: the last position that fit without the ellipsis budget, for the
  // min-characters fallback. Its width is not carried, since the final width comes from the kept glyphs.
  let lastValidCutWithoutEl = -1;

  // :6065-6114
  if (alwaysEllipsis && width + ellipsisWidthPx <= widthPx) {
    return { trimPos: -1, ellipsisPos: isRtl ? 0 : count };
  }
  // `glyphs_to` (`:6062`): a right-to-left search stops before the last glyph, so it never keeps that glyph alone.
  const steps = isRtl ? count - 1 : count;
  for (let step = 0; step < steps; step++) {
    const i = isRtl ? step : count - 1 - step;
    const gp = glyphs[i]!;
    if (!isRtl) width -= gp.advance;
    const aboveMinCharThreshold = (isRtl ? count - 1 - i : i) >= ELL_MIN_CHARACTERS;
    if (!aboveMinCharThreshold && lastValidCutWithoutEl !== -1) {
      trimPos = lastValidCutWithoutEl;
      ellipsisPos = -1;
      break;
    }
    const cutAllowedHere = !(flags.trimWordOnly && aboveMinCharThreshold) || isSoftBreakGlyph(gp);

    if (!alwaysEllipsis && width <= widthPx && lastValidCutWithoutEl === -1 && cutAllowedHere) {
      lastValidCutWithoutEl = i;
    }

    const ellipsisBudget =
      (aboveMinCharThreshold && flags.addEllipsis) || alwaysEllipsis ? ellipsisWidthPx : 0;
    if (width + ellipsisBudget <= widthPx && cutAllowedHere) {
      trimPos = i;
      if (
        flags.addEllipsis &&
        (aboveMinCharThreshold || alwaysEllipsis) &&
        width - ellipsisWidthPx <= widthPx
      ) {
        ellipsisPos = trimPos;
      }
      break;
    }
    if (isRtl) width -= gp.advance;
  }

  // :6118-6120
  if (trimPos === 0 && alwaysEllipsis && flags.addEllipsis) ellipsisPos = 0;
  return { trimPos, ellipsisPos };
}

function advanceOf(glyphs: readonly { advance: number }[]): number {
  return glyphs.reduce((sum, g) => sum + g.advance, 0);
}

function shiftGlyphs(glyphs: readonly GlyphPlacement[], dx: number): GlyphPlacement[] {
  return dx === 0 ? [...glyphs] : glyphs.map((g) => ({ ...g, x: g.x + dx }));
}

/** The ellipsis glyphs in draw order, from `startPx`. */
function placeEllipsis(
  ellipsis: readonly EllipsisGlyph[],
  startPx: number,
  fontMetrics: FontMetrics
): GlyphPlacement[] {
  let penX = startPx;
  return ellipsis.map(({ char, advance, emboldenGrowthPx }) => {
    const placed: GlyphPlacement = {
      char,
      x: penX,
      advance,
      glyph: atlasGlyphFor(fontMetrics, char),
      isEllipsis: true,
    };
    if (emboldenGrowthPx !== undefined) placed.emboldenGrowthPx = emboldenGrowthPx;
    penX += advance;
    return placed;
  });
}

/**
 * A one-line paragraph trimmed to `widthPx`, as `TextLine::draw` or a one-row `TextParagraph::draw`
 * trims it. Returns `layout` itself when nothing is cut, so a memo downstream holds.
 */
export function trimSoloLine(
  layout: TextLayoutResult,
  flags: OverrunTrimFlags,
  widthPx: number,
  options: OverrunTrimOptions
): TextLayoutResult {
  if (!flags.trim) return layout;
  const line = layout.lines[0]!;
  const trimmedLine = trimLineToWidth(line, widthPx, flags, options);
  return trimmedLine === line && layout.lines.length === 1 ? layout : soloLineLayout(trimmedLine, layout);
}
