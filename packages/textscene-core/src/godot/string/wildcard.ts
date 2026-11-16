/**
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { findUpper } from './caseMapping';

type Fold = (code: number) => number;

/** `_wildcard_match` (ustring.cpp:3523): `*` takes any run, `?` one code that is not a dot. */
function matchesFrom(pattern: string[], at: number, text: string[], from: number, fold: Fold): boolean {
  if (at === pattern.length) return from === text.length;
  const wildcard = pattern[at]!;
  if (wildcard === '*') {
    return (
      matchesFrom(pattern, at + 1, text, from, fold) ||
      (from < text.length && matchesFrom(pattern, at, text, from + 1, fold))
    );
  }
  if (from === text.length) return false;
  if (wildcard === '?') return text[from] !== '.' && matchesFrom(pattern, at + 1, text, from + 1, fold);
  const isSame = fold(text[from]!.codePointAt(0)!) === fold(wildcard.codePointAt(0)!);
  return isSame && matchesFrom(pattern, at + 1, text, from + 1, fold);
}

const matches = (text: string, wildcard: string, fold: Fold) =>
  text !== '' && wildcard !== '' && matchesFrom([...wildcard], 0, [...text], 0, fold);

/** `String::match`: an empty text or pattern matches nothing. */
export const wildcardMatch = (text: string, wildcard: string): boolean =>
  matches(text, wildcard, (code) => code);

/** `String::matchn`: `match` on the upper case of each code. */
export const wildcardMatchNoCase = (text: string, wildcard: string): boolean =>
  matches(text, wildcard, findUpper);
