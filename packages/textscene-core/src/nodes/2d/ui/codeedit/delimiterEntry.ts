/**
 * One `delimiter_strings` or `delimiter_comments` entry as `CodeEdit::_set_delimiters` reads it.
 * The validator, the collision rule and the render-side delimiter list all split and admit an
 * entry here, so they cannot disagree about which delimiters Godot stores.
 */

import { isGodotSymbol } from './symbolChars.js';

/** The two keys of an entry. An empty `endKey` makes a line-only delimiter. */
export interface DelimiterKeys {
  startKey: string;
  endKey: string;
}

/**
 * `get_slicec(' ', 0)` and, when a space exists, `get_slicec(' ', 1)` (code_edit.cpp:3501-3502):
 * the start key before the first space and the end key up to the next. The rest is ignored.
 */
export function splitDelimiterEntry(entry: string): DelimiterKeys {
  const [startKey = '', endKey = ''] = entry.split(' ');
  return { startKey, endKey };
}

/**
 * Whether `_add_delimiter` passes its own guards: a non-empty start key, and both keys made only of
 * symbol characters (code_edit.cpp:3421-3432). A start key already stored is the caller's question.
 */
export function passesDelimiterGuards({ startKey, endKey }: DelimiterKeys): boolean {
  return startKey !== '' && [...startKey, ...endKey].every(isGodotSymbol);
}
