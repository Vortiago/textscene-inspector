/**
 * The `visible_characters` and `visible_ratio` pair that Label and RichTextLabel share: two setters
 * that derive each other from the text's character count (`label.cpp:1285-1327`,
 * `rich_text_label.cpp:7401-7430,7892-7948`), and the draw-time skip of both (`label.cpp:778-883`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { storedReal } from '../../../../godot/math/real';
import { codePointCount, utf16OffsetOf } from '../../../../godot/string/codePoints';
import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { GlyphPlacement, TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';
import { perObject } from '../../../../utils/perObject';

interface VisibleCharsState {
  visibleChars: number;
  visibleRatio: number;
  /** The setter that ran last: the other field is derived from it and the text length. Absent for the defaults. */
  lastSetter?: 'characters' | 'ratio';
}

/** Godot's construction defaults for both classes (label.h:75-76, rich_text_label.h:553). */
const DEFAULT_VISIBLE_CHARS_STATE: VisibleCharsState = { visibleChars: -1, visibleRatio: 1 };

/**
 * `Label::set_visible_characters` (label.cpp:1285-1299): a no-op when `p_amount` matches the current
 * field, else re-derives both fields from the current text length. On empty text Label resets the
 * ratio to 1 (`label.cpp:1288`) and RichTextLabel keeps it (`rich_text_label.cpp:7898-7900`).
 */
function applySetVisibleCharacters(
  state: VisibleCharsState,
  amount: number,
  totalChars: number,
  resetsRatioOnEmptyText: boolean
): VisibleCharsState {
  if (state.visibleChars === amount) return state;
  const emptyTextRatio = resetsRatioOnEmptyText ? 1 : state.visibleRatio;
  const visibleRatio = amount === -1 ? 1 : totalChars === 0 ? emptyTextRatio : amount / totalChars;
  return { visibleChars: amount, visibleRatio, lastSetter: 'characters' };
}

/**
 * `count * ratio` as an `int`, in single precision as Godot's `int * float` is: 44 times 30/44 is
 * 29.999999999999996 in double precision, which truncates to 29, and 30 in float.
 */
export function truncatedShare(count: number, ratio: number): number {
  return Math.trunc(storedReal(count * storedReal(ratio)));
}

/** `Label::set_visible_ratio` (label.cpp:1305-1323): a no-op when `p_ratio` matches the current field. */
function applySetVisibleRatio(
  state: VisibleCharsState,
  ratio: number,
  totalChars: number
): VisibleCharsState {
  if (state.visibleRatio === ratio) return state;
  if (ratio >= 1) return { visibleChars: -1, visibleRatio: 1, lastSetter: 'ratio' };
  if (ratio < 0) return { visibleChars: 0, visibleRatio: 0, lastSetter: 'ratio' };
  return { visibleChars: truncatedShare(totalChars, ratio), visibleRatio: ratio, lastSetter: 'ratio' };
}

/**
 * `visible_characters` and `visible_ratio` derive each other, and each setter runs only when its own
 * field changes (label.cpp:1286,1306), so the last one written wins. Godot applies `_set` in file order
 * (packed_scene.cpp:492), which the raw property bag keeps. `text` counts as applied first, as every
 * Godot save writes it first (`ADD_PROPERTY`, label.cpp:1431), even in a hand-edited file.
 */
function resolveVisibleChars(
  properties: Record<string, string>,
  textLength: () => number,
  resetsRatioOnEmptyText: boolean
): VisibleCharsState | undefined {
  const rawChars = properties.visible_characters;
  const rawRatio = properties.visible_ratio;
  if (rawChars === undefined && rawRatio === undefined) return undefined;

  const totalChars = textLength();
  let state = DEFAULT_VISIBLE_CHARS_STATE;
  for (const key of Object.keys(properties)) {
    if (key === 'visible_characters') {
      const amount = parseOptionalInt(rawChars);
      if (amount !== undefined)
        state = applySetVisibleCharacters(state, amount, totalChars, resetsRatioOnEmptyText);
    } else if (key === 'visible_ratio') {
      const ratio = parseOptionalFloat(rawRatio);
      if (ratio !== undefined) state = applySetVisibleRatio(state, ratio, totalChars);
    }
  }
  return state;
}

/** Label's pair: empty text resets the ratio (`label.cpp:1288`). */
export function resolveLabelVisibleChars(
  properties: Record<string, string>,
  textLength: () => number
): VisibleCharsState | undefined {
  return resolveVisibleChars(properties, textLength, true);
}

/** RichTextLabel's pair: empty text keeps the ratio (`rich_text_label.cpp:7898-7900`). */
export function resolveRichTextVisibleChars(
  properties: Record<string, string>,
  textLength: () => number
): VisibleCharsState | undefined {
  return resolveVisibleChars(properties, textLength, false);
}

interface VisibleCharsBudget {
  behavior: number;
  /** The text the lines were shaped from. It maps a glyph's UTF-16 `sourceIndex` to the code point count Godot budgets, and only CHARS_AFTER_SHAPING reads it. */
  text: string;
  /** Final resolved `visible_chars` in code points, the budget of CHARS_AFTER_SHAPING. */
  visibleChars: number | undefined;
  /** Final resolved `visible_ratio`, the budget of the GLYPHS_* behaviours. */
  visibleRatio: number | undefined;
  /** The index of a glyph in `text`, where a caller's glyphs do not carry it. Defaults to the glyph's `sourceIndex`. */
  indexOf?: (glyph: GlyphPlacement) => number | undefined;
  /** The characters of the text when the lines hold fewer: RichTextLabel counts each paragraph's characters, trimmed edge spaces included (`rich_text_label.cpp:8017-8033`). Each cluster still counts its glyphs. */
  totalCharacters?: number;
  /** `is_layout_rtl()` (`SolveNode.rtl`), which picks the end GLYPHS_AUTO trims from (`label.cpp:779-780`). Defaults `false`. */
  rtl?: boolean;
}

/**
 * `draw_text`'s per-glyph `skip` (`label.cpp:778-780,label.h:197-240`) over lines already shaped
 * and windowed to `label.cpp`'s `start`/`end` (`:548-559`). CHARS_AFTER_SHAPING hides each glyph whose
 * source character is at or past the budget (`p_glyphs[j].end + p_para_start > p_visible_chars`). The
 * GLYPHS behaviours count glyphs in visual order: GLYPHS_LTR from the front, GLYPHS_RTL from the back
 * (`label.cpp:780`), and GLYPHS_AUTO picks by `rtl_layout` (`:779-780`).
 */
export function applyVisibleCharsReveal(
  lines: readonly TextLineLayout[],
  budget: VisibleCharsBudget
): TextLineLayout[] {
  if (budget.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) return [...lines];
  if (budget.behavior === VisibleCharactersBehavior.VC_CHARS_AFTER_SHAPING) {
    return revealCharacters(lines, budget);
  }
  return revealGlyphs(lines, budget);
}

/**
 * CHARS_AFTER_SHAPING. An ellipsis glyph has no source character: its `end` is -1 (`text_server.h:628`),
 * so it hides where `paragraphStart - 1 > visibleChars`.
 */
function revealCharacters(lines: readonly TextLineLayout[], budget: VisibleCharsBudget): TextLineLayout[] {
  const { text, visibleChars } = budget;
  const indexOf = budget.indexOf ?? ((glyph: GlyphPlacement) => glyph.sourceIndex);
  if (visibleChars === undefined || visibleChars < 0) return [...lines];
  // Glyph source indices are UTF-16 offsets; the budget counts code points.
  const visibleEnd = utf16OffsetOf(text, visibleChars);
  // `paragraphStart - 1 <= visibleChars` in code points is `paragraphStart <= ellipsisEnd`, the offset
  // of code point `visibleChars + 1`.
  const ellipsisEnd = utf16OffsetOf(text, visibleChars + 1);
  return lines.map((line) => {
    const isEllipsisShown = (line.paragraphStart ?? 0) <= ellipsisEnd;
    return {
      ...line,
      glyphs: line.glyphs.filter((glyph) => {
        const index = indexOf(glyph);
        if (index === undefined) return isEllipsisShown;
        // A cluster's `end` is past its last character, so a ligature shows whole or not at all.
        return index + glyph.char.length <= visibleEnd;
      }),
    };
  });
}

/**
 * The glyphs Godot counts for `glyph` (`shaped_text_get_glyph_count`): a cluster draws one, and a
 * base drawn with marks one more for each mark.
 */
const glyphCountOf = (glyph: GlyphPlacement): number => 1 + (glyph.decomposition?.marks.length ?? 0);

/**
 * The glyphs and the characters, in code points, that `lines` draw. Kept per lines array, which
 * RichTextLabel passes again on each reveal tick. Label builds a new array, so it counts again.
 */
const drawnCountsOf = perObject((lines: readonly TextLineLayout[]) => {
  let glyphs = 0;
  let characters = 0;
  for (const line of lines)
    for (const glyph of line.glyphs) {
      glyphs += glyphCountOf(glyph);
      characters += codePointCount(glyph.char);
    }
  return { glyphs, characters };
});

/**
 * The GLYPHS behaviours: `visible_ratio * total_glyphs` glyphs, counted in visual order across lines.
 * A placement shows while its first glyph is within the budget.
 */
function revealGlyphs(lines: readonly TextLineLayout[], budget: VisibleCharsBudget): TextLineLayout[] {
  if (budget.visibleRatio === undefined || budget.visibleRatio >= 1) return [...lines];
  const drawn = drawnCountsOf(lines);
  const totalGlyphs =
    budget.totalCharacters === undefined
      ? drawn.glyphs
      : budget.totalCharacters - drawn.characters + drawn.glyphs;
  const limit = truncatedShare(totalGlyphs, Math.max(0, budget.visibleRatio));
  const fromEnd =
    budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_RTL ||
    (budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_AUTO && budget.rtl === true);
  const hideBefore = fromEnd ? totalGlyphs - limit : 0;
  let seen = 0;
  return lines.map((line) => {
    const glyphs = line.glyphs.filter((glyph) => {
      const isShown = fromEnd ? seen >= hideBefore : seen < limit;
      seen += glyphCountOf(glyph);
      return isShown;
    });
    return glyphs.length === line.glyphs.length ? line : { ...line, glyphs };
  });
}
