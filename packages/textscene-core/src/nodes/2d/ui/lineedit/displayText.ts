/**
 * What a LineEdit paints, from `LineEdit::_shape()` (scene/gui/line_edit.cpp): the placeholder when
 * `text` and `ime_text` are empty, else with `secret` one `secret_character` (default "•") per character,
 * else `text`. The empty test runs first, so a secret field with no text shows its placeholder. A static
 * preview has no IME composition, so `ime_text` is always empty.
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

/** `set_max_length` re-runs `set_text`, which truncates in `insert_text_at_caret` (`line_edit.cpp:2409-2412`) by code points, not UTF-16 units. `maxLength <= 0` is unlimited. */
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
    // `secret_character.left(1)` takes one character, and an empty override falls back to the bullet
    // instead of erasing the echo. Both sides count code points, so a surrogate pair echoes once.
    const echo = raw === '' ? DEFAULT_SECRET_CHARACTER : [...raw][0]!;
    return { text: echo.repeat([...text].length), isPlaceholder: false };
  }
  return { text, isPlaceholder: false };
}
