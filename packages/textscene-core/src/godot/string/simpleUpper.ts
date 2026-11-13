/**
 * `_find_upper` (`core/string/ustring.cpp`): the simple upper-case mapping a name comparison and a wildcard match share.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/** The upper case of a code point, or the code point itself where the mapping is not one code point. */
export function simpleUpper(code: number): number {
  const upper = String.fromCodePoint(code).toUpperCase();
  const mapped = upper.codePointAt(0)!;
  return upper.length === String.fromCodePoint(mapped).length ? mapped : code;
}
