/**
 * The `visible_characters` and `visible_ratio` pair that Label and RichTextLabel share: two setters
 * that derive each other from the text's character count (`label.cpp:1285-1327`,
 * `rich_text_label.cpp:7401-7430,7892-7948`).
 */

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
  totalChars: number
): VisibleCharsState {
  if (state.visibleChars === amount) return state;
  if (amount === -1 || totalChars === 0) return { visibleChars: amount, visibleRatio: 1 };
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
  textLength: () => number
): VisibleCharsState | undefined {
  const rawChars = properties.visible_characters;
  const rawRatio = properties.visible_ratio;
  if (rawChars === undefined && rawRatio === undefined) return undefined;

  const totalChars = textLength();
  let state = DEFAULT_VISIBLE_CHARS_STATE;
  for (const key of Object.keys(properties)) {
    if (key === 'visible_characters') {
      const amount = parseOptionalInt(rawChars);
      if (amount !== undefined) state = applySetVisibleCharacters(state, amount, totalChars);
    } else if (key === 'visible_ratio') {
      const ratio = parseOptionalFloat(rawRatio);
      if (ratio !== undefined) state = applySetVisibleRatio(state, ratio, totalChars);
    }
  }
  return state;
}
