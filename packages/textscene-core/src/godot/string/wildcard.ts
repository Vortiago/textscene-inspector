/**
 * `String::matchn`: a wildcard match without case (`core/string/ustring.cpp:3524-3551`). `*` takes any run,
 * `?` takes one character that is not a dot, and an empty text or pattern matches nothing.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

const upper = (character: string): string => {
  const mapped = character.toUpperCase();
  return [...mapped].length === 1 ? mapped : character;
};

function matchesFrom(pattern: string[], at: number, text: string[], from: number): boolean {
  if (at === pattern.length) return from === text.length;
  const wildcard = pattern[at]!;
  if (wildcard === '*') {
    return (
      matchesFrom(pattern, at + 1, text, from) ||
      (from < text.length && matchesFrom(pattern, at, text, from + 1))
    );
  }
  if (from === text.length) return false;
  if (wildcard === '?') return text[from] !== '.' && matchesFrom(pattern, at + 1, text, from + 1);
  return upper(text[from]!) === upper(wildcard) && matchesFrom(pattern, at + 1, text, from + 1);
}

export function wildcardMatchNoCase(text: string, wildcard: string): boolean {
  if (text === '' || wildcard === '') return false;
  return matchesFrom([...wildcard], 0, [...text], 0);
}
