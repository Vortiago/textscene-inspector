/**
 * Overrun trimming for one already-broken `TextLineLayout` — a port of
 * `TextServer::shaped_text_overrun_trim_to_width`, scoped to this engine's
 * shaping: left-to-right only, one span/one font per line (no per-glyph font
 * fallback search).
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

/** `TextServer::TextOverrunFlag` bits actually reachable from an `OverrunBehavior` (`get_overrun_flags_from_behavior`, `text_server.cpp:2399-2432`) — `OVERRUN_SHORT_STRING_ELLIPSIS` is never set by that mapping and is dropped. `justificationAware` (`OVERRUN_JUSTIFICATION_AWARE`) is set by a caller directly (Label's autowrap-OFF FILL re-trim, `label.cpp:323`), not by this mapping. */
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

/** `ell_min_characters` — `text_server_adv.cpp:6049`. Below this many kept characters, no ellipsis is offered; a plain cut is used instead. */
const ELL_MIN_CHARACTERS = 6;

export interface OverrunTrimOptions {
  fontMetrics: FontMetrics;
  /** The trimmed line's own font size — Godot reads the LAST glyph's own `font_size` (`text_server_adv.cpp:5981`); this engine shapes one size per line unless the caller passes the line's own trailing run size. */
  fontSizePx: number;
  /** `Label.ellipsis_char` / `TextParagraph.ellipsis_char`; defaults to `DEFAULT_ELLIPSIS_CHAR`. */
  ellipsisChar?: string;
  /** `OVERRUN_JUSTIFICATION_AWARE`'s gate, `sd->fit_width_minimum_reached` — set by a prior `fitLineToWidth` call. Irrelevant unless `flags.justificationAware`. */
  fitWidthMinimumReached?: boolean;
}

/** Whether `ch`'s own bitmap exists in this metrics' font — the vendored atlas charset for `'atlas'` metrics, always true for a `'canvas'` (browser) font, which carries no such fixed boundary. */
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
 * Port of `TextServer::shaped_text_overrun_trim_to_width`
 * (`text_server_adv.cpp:5935-6154`), LTR/single-span. Returns `line`
 * unchanged when nothing needs trimming (matches the source's early `return`
 * at `:5958-5966`), otherwise a NEW `TextLineLayout` whose `glyphs`/`text`/
 * `widthPx` all reflect the cut plus any appended ellipsis — the solver reads
 * the SAME `widthPx` a caller re-measures.
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

  // :5985-6046 (span/fallback-font search dropped — one font per line here).
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
  // `last_valid_cut_witout_el` in the source: the last position that fit
  // WITHOUT spending the ellipsis budget, kept only for the min-characters
  // fallback below -- its own width (`width_without_el`) is not carried
  // forward here, since this port recomputes the final width from whichever
  // glyphs are actually kept, rather than threading a second running total.
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

  // `trim_pos < 0` draws every original glyph uncut (`text_server.cpp:1768-1777`) — reachable
  // only via `enforceEllipsis` on a line that already fits, where the ellipsis is appended
  // rather than anything being cut.
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
