/**
 * The character class CodeEdit's delimiter and brace keys must be made of.
 *
 * Shared by `delimiterValidators.ts` and `bracePairValidators.ts`, whose
 * `ERR_FAIL_COND_MSG` guards both call `is_symbol` on every character of a key.
 */

/**
 * Mirrors `is_symbol` (core/string/char_utils.h:113-114): every ASCII
 * punctuation range plus tab and space, excluding underscore. Godot's
 * delimiter and auto-brace-completion keys must be made only of these.
 */
export function isGodotSymbol(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code === 0x5f) return false;
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e) ||
    code === 0x09 ||
    code === 0x20
  );
}
