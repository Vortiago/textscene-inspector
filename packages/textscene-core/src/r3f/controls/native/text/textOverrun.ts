/**
 * Overrun trimming for one broken `TextLineLayout`: a port of
 * `TextServer::shaped_text_overrun_trim_to_width`, left to right only, with one span and one font
 * per line and no per-glyph font fallback search.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { OPEN_SANS_ATLAS_GLYPHS } from './openSansAtlas';
import { getFontGlyphAdvancePx, type FontMetrics } from './fontMetrics';
import { isWhitespace, type GlyphPlacement, type TextLineLayout } from './textLayout';

/** `TextServer::OverrunBehavior` (`servers/text/text_server.h:123-131`). */
export enum OverrunBehavior {
  NO_TRIMMING = 0,
  TRIM_CHAR = 1,
  TRIM_WORD = 2,
  TRIM_ELLIPSIS = 3,
  TRIM_WORD_ELLIPSIS = 4,
  TRIM_ELLIPSIS_FORCE = 5,
  TRIM_WORD_ELLIPSIS_FORCE = 6,
}

/**
 * The `TextServer::TextOverrunFlag` bits an `OverrunBehavior` reaches (`text_server.cpp:2399-2432`),
 * without `OVERRUN_SHORT_STRING_ELLIPSIS`, which that mapping never sets. A caller sets
 * `justificationAware` directly, as Label's autowrap-off FILL re-trim does (`label.cpp:323`).
 */
export interface OverrunTrimFlags {
  trim: boolean;
  trimWordOnly: boolean;
  addEllipsis: boolean;
  enforceEllipsis: boolean;
  justificationAware: boolean;
}

const NO_TRIM_FLAGS: OverrunTrimFlags = {
  trim: false,
  trimWordOnly: false,
  addEllipsis: false,
  enforceEllipsis: false,
  justificationAware: false,
};

/** `TextServer::get_overrun_flags_from_behavior` (`text_server.cpp:2399-2432`). */
export function overrunFlagsForBehavior(behavior: OverrunBehavior): OverrunTrimFlags {
  switch (behavior) {
    case OverrunBehavior.TRIM_WORD_ELLIPSIS_FORCE:
      return { trim: true, trimWordOnly: true, addEllipsis: true, enforceEllipsis: true, justificationAware: false };
    case OverrunBehavior.TRIM_ELLIPSIS_FORCE:
      return { trim: true, trimWordOnly: false, addEllipsis: true, enforceEllipsis: true, justificationAware: false };
    case OverrunBehavior.TRIM_WORD_ELLIPSIS:
      return { trim: true, trimWordOnly: true, addEllipsis: true, enforceEllipsis: false, justificationAware: false };
    case OverrunBehavior.TRIM_ELLIPSIS:
      return { trim: true, trimWordOnly: false, addEllipsis: true, enforceEllipsis: false, justificationAware: false };
    case OverrunBehavior.TRIM_WORD:
      return { trim: true, trimWordOnly: true, addEllipsis: false, enforceEllipsis: false, justificationAware: false };
    case OverrunBehavior.TRIM_CHAR:
      return { trim: true, trimWordOnly: false, addEllipsis: false, enforceEllipsis: false, justificationAware: false };
    case OverrunBehavior.NO_TRIMMING:
    default:
      return NO_TRIM_FLAGS;
  }
}

/** The default ellipsis every caller falls back to, `String::chr(0x2026)` (`label.cpp:294` et al.'s `(el_char.length() > 0) ? el_char[0] : 0x2026`). */
export const DEFAULT_ELLIPSIS_CHAR = '…';

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

/**
 * Port of `TextServer::shaped_text_overrun_trim_to_width` (`text_server_adv.cpp:5935-6154`). Returns
 * `line` unchanged when nothing needs trimming (`:5958-5966`), else a new layout whose glyphs, text
 * and `widthPx` include the cut and any ellipsis.
 */
export function trimLineToWidth(line: TextLineLayout, widthPx: number, flags: OverrunTrimFlags, options: OverrunTrimOptions): TextLineLayout {
  const { fontMetrics, fontSizePx, ellipsisChar = DEFAULT_ELLIPSIS_CHAR, fitWidthMinimumReached = false } = options;
  const glyphs = line.glyphs;

  // :5958
  if (!flags.trim || glyphs.length === 0 || widthPx <= 0 || !(line.widthPx > widthPx || flags.enforceEllipsis)) {
    return line;
  }
  // :5964-5966
  if (flags.justificationAware && !fitWidthMinimumReached) {
    return line;
  }

  // :5985-6046, without the span and fallback-font search: one font per line here.
  const foundElChar = flags.addEllipsis || flags.enforceEllipsis ? hasGlyphInk(fontMetrics, ellipsisChar) : true;
  const dotChar = foundElChar ? ellipsisChar : '.';
  const dotRepeat = foundElChar ? 1 : 3;
  const dotAdvancePx = flags.addEllipsis || flags.enforceEllipsis ? getFontGlyphAdvancePx(fontMetrics, dotChar, fontSizePx) : 0;
  const whitespaceAdvancePx = getFontGlyphAdvancePx(fontMetrics, ' ', fontSizePx);
  // :6044-6046 -- `int ellipsis_width` truncates.
  const ellipsisWidthPx = flags.addEllipsis
    ? Math.trunc(dotRepeat * dotAdvancePx + (flags.trimWordOnly ? whitespaceAdvancePx : 0))
    : 0;

  let width = line.widthPx;
  let trimPos = 0;
  let ellipsisPos = flags.enforceEllipsis ? 0 : -1;
  // `last_valid_cut_witout_el`: the last position that fit without the ellipsis budget, for the
  // min-characters fallback. Its width is not carried, since the final width comes from the kept glyphs.
  let lastValidCutWithoutEl = -1;

  // :6065-6114
  if (flags.enforceEllipsis && width + ellipsisWidthPx <= widthPx) {
    trimPos = -1;
    ellipsisPos = glyphs.length;
  } else {
    for (let i = glyphs.length - 1; i >= 0; i--) {
      const gp = glyphs[i]!;
      width -= gp.advance;
      const aboveMinCharThreshold = i >= ELL_MIN_CHARACTERS;
      if (!aboveMinCharThreshold && lastValidCutWithoutEl !== -1) {
        trimPos = lastValidCutWithoutEl;
        ellipsisPos = -1;
        break;
      }
      const cutAllowedHere = !(flags.trimWordOnly && aboveMinCharThreshold) || isSoftBreakGlyph(gp);

      if (!flags.enforceEllipsis && width <= widthPx && lastValidCutWithoutEl === -1 && cutAllowedHere) {
        lastValidCutWithoutEl = i;
      }

      const ellipsisBudget = (aboveMinCharThreshold && flags.addEllipsis) || flags.enforceEllipsis ? ellipsisWidthPx : 0;
      if (width + ellipsisBudget <= widthPx && cutAllowedHere) {
        trimPos = i;
        if (flags.addEllipsis && (aboveMinCharThreshold || flags.enforceEllipsis) && width - ellipsisWidthPx <= widthPx) {
          ellipsisPos = trimPos;
        }
        break;
      }
    }
  }

  // :6118-6120
  if (trimPos === 0 && flags.enforceEllipsis && flags.addEllipsis) {
    ellipsisPos = 0;
  }

  // :6122
  if (!((trimPos >= 0 && line.widthPx > widthPx) || flags.enforceEllipsis)) {
    return line;
  }

  // `trim_pos < 0` draws every glyph uncut (`text_server.cpp:1768-1777`): only `enforceEllipsis` on a
  // line that fits reaches it, and appends the ellipsis.
  const kept = trimPos < 0 ? glyphs : glyphs.slice(0, trimPos);
  let penX = kept.length > 0 ? kept[kept.length - 1]!.x + kept[kept.length - 1]!.advance : 0;
  const appended: GlyphPlacement[] = [];

  // :6123-6149
  if (flags.addEllipsis && (ellipsisPos > 0 || flags.enforceEllipsis)) {
    if (flags.trimWordOnly && ellipsisPos > 0) {
      appended.push({ char: ' ', x: penX, advance: whitespaceAdvancePx, glyph: atlasGlyphFor(fontMetrics, ' ') });
      penX += whitespaceAdvancePx;
    }
    for (let r = 0; r < dotRepeat; r++) {
      appended.push({ char: dotChar, x: penX, advance: dotAdvancePx, glyph: atlasGlyphFor(fontMetrics, dotChar) });
      penX += dotAdvancePx;
    }
  }

  const finalGlyphs = [...kept, ...appended];
  return {
    text: finalGlyphs.map((g) => g.char).join(''),
    glyphs: finalGlyphs,
    widthPx: penX,
  };
}
