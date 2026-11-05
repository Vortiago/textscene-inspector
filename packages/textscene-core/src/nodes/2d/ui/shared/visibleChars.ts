/**
 * The `visible_characters` and `visible_ratio` pair that Label and RichTextLabel share: two setters
 * that derive each other from the text's character count (`label.cpp:1285-1327`,
 * `rich_text_label.cpp:7401-7430,7892-7948`).
 */

import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';

interface VisibleCharsState {
  visibleChars: number;
  visibleRatio: number;
}

/** Godot's construction defaults for both classes (label.h:75-76, rich_text_label.h:553). */
const DEFAULT_VISIBLE_CHARS_STATE: VisibleCharsState = { visibleChars: -1, visibleRatio: 1 };

/** `Label::set_visible_characters` (label.cpp:1285-1299): a no-op when `p_amount` matches the current field, else re-derives both fields from the current text length. */
function applySetVisibleCharacters(
  state: VisibleCharsState,
  amount: number,
  totalChars: number,
  emptyTextKeepsRatio: boolean
): VisibleCharsState {
  if (state.visibleChars === amount) return state;
  if (amount === -1) return { visibleChars: amount, visibleRatio: 1 };
  // Label resets the ratio on empty text (label.cpp:1288); RichTextLabel leaves it (:7898-7900).
  if (totalChars === 0)
    return { visibleChars: amount, visibleRatio: emptyTextKeepsRatio ? state.visibleRatio : 1 };
  return { visibleChars: amount, visibleRatio: amount / totalChars };
}

/**
 * `count * ratio` as an `int`, in single precision as Godot's `int * float` is: 44 times 30/44 is
 * 29.999999999999996 in double precision, which truncates to 29, and 30 in float.
 */
export function truncatedShare(count: number, ratio: number): number {
  return Math.trunc(Math.fround(count * Math.fround(ratio)));
}

/** `Label::set_visible_ratio` (label.cpp:1305-1323): a no-op when `p_ratio` matches the current field. */
function applySetVisibleRatio(
  state: VisibleCharsState,
  ratio: number,
  totalChars: number
): VisibleCharsState {
  if (state.visibleRatio === ratio) return state;
  if (ratio >= 1) return { visibleChars: -1, visibleRatio: 1 };
  if (ratio < 0) return { visibleChars: 0, visibleRatio: 0 };
  return { visibleChars: truncatedShare(totalChars, ratio), visibleRatio: ratio };
}

/**
 * `visible_characters` and `visible_ratio` derive each other, and each setter runs only when its own
 * field changes (label.cpp:1286,1306), so the last one written wins. Godot applies `_set` in file order
 * (packed_scene.cpp:492), which the raw property bag keeps. `text` counts as applied first, as every
 * Godot save writes it first (`ADD_PROPERTY`, label.cpp:1431), even in a hand-edited file.
 */
export function resolveVisibleChars(
  properties: Record<string, string>,
  textLength: () => number,
  emptyTextKeepsRatio = false
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
        state = applySetVisibleCharacters(state, amount, totalChars, emptyTextKeepsRatio);
    } else if (key === 'visible_ratio') {
      const ratio = parseOptionalFloat(rawRatio);
      if (ratio !== undefined) state = applySetVisibleRatio(state, ratio, totalChars);
    }
  }
  return state;
}

export interface VisibleCharsBudget {
  behavior: number;
  /** Final resolved `visible_chars`, the budget of CHARS_AFTER_SHAPING. */
  visibleChars: number | undefined;
  /** Final resolved `visible_ratio`, the budget of the GLYPHS_* behaviours. */
  visibleRatio: number | undefined;
  /** Total glyphs when it is not the lines' count: RichTextLabel counts each paragraph's glyphs, trimmed edge spaces included (`rich_text_label.cpp:8017-8033`). */
  totalGlyphs?: number;
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
    return revealCharacters(lines, budget.visibleChars);
  }
  return revealGlyphs(lines, budget);
}

/**
 * CHARS_AFTER_SHAPING. An ellipsis glyph has no source character: its `end` is -1 (`text_server.h:628`),
 * so it hides where `paragraphStart - 1 > visibleChars`.
 */
function revealCharacters(
  lines: readonly TextLineLayout[],
  visibleChars: number | undefined
): TextLineLayout[] {
  if (visibleChars === undefined || visibleChars < 0) return [...lines];
  return lines.map((line) => {
    const isEllipsisShown = (line.paragraphStart ?? 0) - 1 <= visibleChars;
    return {
      ...line,
      glyphs: line.glyphs.filter((glyph) =>
        glyph.sourceIndex === undefined ? isEllipsisShown : glyph.sourceIndex < visibleChars
      ),
    };
  });
}

/** The GLYPHS behaviours: `visible_ratio * total_glyphs` glyphs, counted in visual order across lines. */
function revealGlyphs(lines: readonly TextLineLayout[], budget: VisibleCharsBudget): TextLineLayout[] {
  if (budget.visibleRatio === undefined || budget.visibleRatio >= 1) return [...lines];
  const totalGlyphs = budget.totalGlyphs ?? lines.reduce((sum, l) => sum + l.glyphs.length, 0);
  const limit = truncatedShare(totalGlyphs, Math.max(0, budget.visibleRatio));
  const fromEnd =
    budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_RTL ||
    (budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_AUTO && budget.rtl === true);
  const hideBefore = fromEnd ? totalGlyphs - limit : 0;
  let seen = 0;
  return lines.map((line) => ({
    ...line,
    glyphs: line.glyphs.filter(() => {
      const keep = fromEnd ? seen >= hideBefore : seen < limit;
      seen++;
      return keep;
    }),
  }));
}
