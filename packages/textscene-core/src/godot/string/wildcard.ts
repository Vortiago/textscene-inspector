/**
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { findUpper } from './caseMapping.js';
import { codesOf } from './ustring/codes.js';
import { unfolded, type Fold } from './ustring/search.js';

const STAR = 0x2a;
const QUESTION_MARK = 0x3f;
const DOT = 0x2e;

/** `?` takes one code that is not a dot, any other code only itself. */
const isOneMatch = (wildcard: number, code: number, fold: Fold) =>
  wildcard === QUESTION_MARK ? code !== DOT : fold(code) === fold(wildcard);

/** `_wildcard_match` (ustring.cpp:3524) as a loop, since a long text overflows a recursive one in V8. */
function isMatch(pattern: readonly number[], text: readonly number[], fold: Fold): boolean {
  let [at, from] = [0, 0];
  let [star, starFrom] = [-1, 0];
  while (from < text.length) {
    if (pattern[at] === STAR) [star, starFrom, at] = [at, from, at + 1];
    else if (at < pattern.length && isOneMatch(pattern[at]!, text[from]!, fold))
      [at, from] = [at + 1, from + 1];
    else if (star === -1) return false;
    else [at, from, starFrom] = [star + 1, starFrom + 1, starFrom + 1];
  }
  while (pattern[at] === STAR) at++;
  return at === pattern.length;
}

const matches = (text: string, wildcard: string, fold: Fold) =>
  text !== '' && wildcard !== '' && isMatch(codesOf(wildcard), codesOf(text), fold);

/** `String::match`: an empty text or pattern matches nothing. */
export const wildcardMatch = (text: string, wildcard: string): boolean => matches(text, wildcard, unfolded);

/** `String::matchn`: `match` on the upper case of each code. */
export const wildcardMatchNoCase = (text: string, wildcard: string): boolean =>
  matches(text, wildcard, findUpper);
