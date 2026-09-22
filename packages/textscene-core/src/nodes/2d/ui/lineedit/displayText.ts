/**
 * What a LineEdit actually paints, transcribed from `LineEdit::_shape()`
 * (scene/gui/line_edit.cpp):
 *
 *     String t;
 *     if (text.is_empty() && ime_text.is_empty()) {
 *       t = placeholder_translated;
 *     } else if (pass) {
 *       String s = secret_character.is_empty() ? U"•" : secret_character.left(1);
 *       t = s.repeat(text.length() + ime_text.length());
 *     } else {
 *       t = text;
 *     }
 *
 * The branch ORDER is the load-bearing part: an empty `text` shows the
 * placeholder even when `secret` is set, so a secret field never echoes bullets
 * for a string it does not have. There is no IME composition in a static
 * preview, so `ime_text` is always empty here.
 *
 * `max_length` is applied to `text` first: `set_max_length` re-runs
 * `set_text`, which truncates through `insert_text_at_caret`'s
 * `available_chars` check (`line_edit.cpp:2409-2412`) — code points, not
 * UTF-16 units. 0 (the Godot default) means unlimited.
 *
 * Pure `.ts` — the Component only renders what this returns.
 */

import type { LineEditProperties } from './types';

/** Godot's fallback echo character when `secret_character` is empty. */
export const DEFAULT_SECRET_CHARACTER = '•';

export interface LineEditDisplayText {
  /** The string to paint. */
  text: string;
  /** True when that string is the placeholder, which Godot draws dimmed. */
  isPlaceholder: boolean;
}

/** `insert_text_at_caret`'s truncation (`line_edit.cpp:2409-2412`) — code points, not UTF-16 units; `maxLength <= 0` is unlimited. */
function truncateToMaxLength(text: string, maxLength: number | undefined): string {
  if (!maxLength || maxLength <= 0) return text;
  const codePoints = [...text];
  return codePoints.length > maxLength ? codePoints.slice(0, maxLength).join('') : text;
}

export function lineEditDisplayText(props: LineEditProperties): LineEditDisplayText {
  const text = truncateToMaxLength(props.text ?? '', props.maxLength);
  if (text === '') return { text: props.placeholderText ?? '', isPlaceholder: true };

  if (props.secret) {
    const raw = props.secretCharacter ?? DEFAULT_SECRET_CHARACTER;
    // `secret_character.left(1)` takes ONE character, and an empty override
    // falls back to the bullet rather than erasing the echo. Both sides count
    // code points, not UTF-16 units, so a surrogate pair echoes once.
    const echo = raw === '' ? DEFAULT_SECRET_CHARACTER : [...raw][0]!;
    return { text: echo.repeat([...text].length), isPlaceholder: false };
  }
  return { text, isPlaceholder: false };
}
