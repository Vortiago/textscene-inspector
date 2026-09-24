/**
 * CodeEdit's delimiter tracking: `delimiter_comments` and `delimiter_strings` as the delimiter cache and
 * position getters read them (`scene/gui/code_edit.cpp:3210-3415,2082-2180`). Its one still-frame
 * surface is the fold gutter: `CodeHighlighter` colours from its own `color_regions`
 * (`scene/resources/syntax_highlighter.cpp` names no delimiter), so nothing here paints text.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { isGodotSymbol } from './symbolChars.js';

/** `CodeEdit::DelimiterType` (`code_edit.h`). */
export type DelimiterType = 'comment' | 'string';

/** One entry of `CodeEdit::delimiters` (`code_edit.h`'s `Delimiter`). */
export interface Delimiter {
  type: DelimiterType;
  startKey: string;
  endKey: string;
  /** `p_line_only || p_end_key.is_empty()` (`code_edit.cpp:3448`). */
  lineOnly: boolean;
}

/**
 * `CodeEdit::_set_delimiters` (`code_edit.cpp:3490-3508`): each entry is `"<start>[ <end>]"`, split on
 * the first space, and one with no end key is line-only. `_add_delimiter` (`:3418-3442`) drops an empty,
 * non-symbol or repeated start key, and inserts by descending start-key length (`:3434-3442`), so a
 * longer key wins over a shorter prefix when the cache scans.
 */
export function buildDelimiters(
  comments: readonly string[] | undefined,
  strings: readonly string[] | undefined
): Delimiter[] {
  const out: Delimiter[] = [];
  const add = (entries: readonly string[], type: DelimiterType): void => {
    for (const entry of entries) {
      if (entry.length === 0) continue;
      const space = entry.indexOf(' ');
      const startKey = space === -1 ? entry : entry.slice(0, space);
      const endKey = space === -1 ? '' : entry.slice(space + 1).split(' ')[0]!;
      if (startKey.length === 0) continue;
      if (![...startKey, ...endKey].every(isGodotSymbol)) continue;
      let at = 0;
      let duplicate = false;
      for (const existing of out) {
        if (existing.startKey === startKey) {
          duplicate = true;
          break;
        }
        if (startKey.length < existing.startKey.length) at++;
        else break;
      }
      if (duplicate) continue;
      out.splice(at, 0, { type, startKey, endKey, lineOnly: endKey.length === 0 });
    }
  };
  // CodeEdit's constructor registers `"` and `'` as string delimiters
  // (`code_edit.cpp:3920-3922`). An authored `delimiter_strings` replaces
  // them, since `_set_delimiters` clears the type first (`:3492`).
  add(strings ?? ['"', "'"], 'string');
  add(comments ?? [], 'comment');
  return out;
}

/**
 * One line's entry in `delimiter_cache`, Godot's `RBMap<int, int>` in key order. The key is a
 * column + 1, and the value the delimiter index the line is in from there on, or `-1` for none.
 */
export type DelimiterCacheLine = Array<[column: number, region: number]>;

/**
 * `CodeEdit::_update_delimiter_cache` (`code_edit.cpp:3210-3367`) over the whole buffer, the only
 * range a still frame needs. The scan walks each line, skipping a `\` and the character after it,
 * and records the column each region opens and closes at.
 */
export function buildDelimiterCache(
  lines: readonly string[],
  delimiters: readonly Delimiter[]
): DelimiterCacheLine[] {
  const cache: DelimiterCacheLine[] = lines.map(() => []);
  if (delimiters.length === 0) return cache;

  for (let i = 0; i < lines.length; i++) {
    // Whatever region the line above left open carries in here: that is how a
    // block comment spans lines (`code_edit.cpp:3238`).
    let inRegion = i <= 0 || cache[i - 1]!.length < 1 ? -1 : cache[i - 1]![cache[i - 1]!.length - 1]![1];
    const str = lines[i]!;
    const lineLength = str.length;
    const line: DelimiterCacheLine = [];
    cache[i] = line;
    const put = (column: number, region: number): void => {
      const at = line.findIndex(([key]) => key >= column);
      if (at !== -1 && line[at]![0] === column) line[at] = [column, region];
      else if (at === -1) line.push([column, region]);
      else line.splice(at, 0, [column, region]);
    };

    if (lineLength === 0) {
      if (inRegion !== -1) put(0, inRegion);
      continue;
    }

    for (let j = 0; j < lineLength; j++) {
      let from = j;
      for (; from < lineLength; from++) {
        if (str[from] === '\\') {
          from++;
          continue;
        }
        break;
      }

      let sameLine = false;
      if (inRegion === -1) {
        for (let d = 0; d < delimiters.length; d++) {
          const { startKey, endKey, lineOnly } = delimiters[d]!;
          if (lineLength - from < startKey.length) continue;
          if (str.slice(from, from + startKey.length) !== startKey) continue;
          sameLine = true;
          inRegion = d;
          put(from + 1, d);
          from += startKey.length;
          if (endKey.length === 0 || lineOnly || from + endKey.length > lineLength) {
            j = lineLength;
            if (lineOnly) put(lineLength + 1, -1);
          }
          break;
        }
        if (j === lineLength || inRegion === -1) continue;
      }

      let regionEndIndex = -1;
      const endKey = delimiters[inRegion]!.endKey;
      for (; from < lineLength; from++) {
        if (lineLength - from < endKey.length) break;
        if (!isGodotSymbol(str[from]!)) continue;
        if (str[from] === '\\') {
          from++;
          continue;
        }
        regionEndIndex = from;
        if (str.slice(from, from + endKey.length) !== endKey) regionEndIndex = -1;
        if (regionEndIndex !== -1) break;
      }

      j = from + (endKey.length - 1);
      const endRegion = regionEndIndex === -1 ? inRegion : -1;
      if (!sameLine || regionEndIndex !== -1) put(j + 1, endRegion);
      inRegion = -1;
    }
  }
  return cache;
}

/** The region index that carried into `line` from the one above, or `-1`. */
function regionBefore(cache: readonly DelimiterCacheLine[], line: number): number {
  if (line <= 0) return -1;
  const previous = cache[line - 1]!;
  return previous.length < 1 ? -1 : previous[previous.length - 1]![1];
}

/**
 * `CodeEdit::_is_in_delimiter` (`code_edit.cpp:3369-3415`) at `p_column = -1`: is the whole line,
 * whitespace aside, inside a region of this type? The only form `can_fold_line` asks. Returns the
 * delimiter index, or `-1`.
 */
export function isLineInDelimiter(
  lines: readonly string[],
  delimiters: readonly Delimiter[],
  cache: readonly DelimiterCacheLine[],
  line: number,
  type: DelimiterType
): number {
  if (delimiters.length === 0 || line >= cache.length) return -1;
  let region = regionBefore(cache, line);
  let inRegion = region !== -1 && delimiters[region]!.type === type;
  const text = lines[line] ?? '';

  for (const [key, value] of cache[line]!) {
    if (!inRegion) {
      if (value === -1 || delimiters[value]!.type !== type) break;
      region = value;
      // Godot's `in_region = true` here is dead at `p_column = -1`: every path
      // out of this iteration returns, so nothing reads it again.
      for (let i = key - 2; i >= 0; i--) {
        if (!isWhitespace(text[i])) return -1;
      }
    }

    if (delimiters[region]!.lineOnly) return region;

    let endCol = key;
    if (value !== -1) {
      const next = cache[line]!.find(([k]) => k > key);
      if (!next) return region;
      endCol = next[0];
    }
    for (let i = endCol; i < text.length; i++) {
      if (!isWhitespace(text[i])) return -1;
    }
    return region;
  }
  return inRegion ? region : -1;
}

/** `is_whitespace` (`core/string/char_utils.h`) over the characters a `.tscn` line can hold. */
function isWhitespace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\v' || ch === '\f';
}

/**
 * `CodeEdit::get_delimiter_start_position` and `get_delimiter_end_position` (`code_edit.cpp:2082-2180`),
 * reduced to the line each returns: `can_fold_line` reads nothing else (`:1701-1721`).
 */
export function delimiterStartLine(
  lines: readonly string[],
  cache: readonly DelimiterCacheLine[],
  delimiters: readonly Delimiter[],
  line: number,
  column: number
): number {
  if (delimiters.length === 0) return -1;
  let inRegion = regionBefore(cache, line) !== -1;
  let startX = -1;
  for (const [key, value] of cache[line]!) {
    if (key > column) break;
    inRegion = value !== -1;
    startX = inRegion ? key : -1;
  }

  let lineLength = (lines[line] ?? '').length;
  if (startX !== -1 && lineLength > 0 && startX !== lineLength + 1) return line;
  if (!inRegion) return -1;

  let startY = -1;
  for (let i = line - 1; i >= 0; i--) {
    if (cache[i]!.length < 1) continue;
    startY = i;
    startX = cache[i]![cache[i]!.length - 1]![0];
    lineLength = (lines[i] ?? '').length;
    if (lineLength > 0 && startX !== lineLength + 1) break;
  }
  return startY;
}

export function delimiterEndLine(
  lines: readonly string[],
  cache: readonly DelimiterCacheLine[],
  delimiters: readonly Delimiter[],
  line: number,
  column: number
): number {
  if (delimiters.length === 0) return -1;
  let region = regionBefore(cache, line);
  let endX = -1;
  for (const [key, value] of cache[line]!) {
    endX = value === -1 ? key : -1;
    if (key > column) break;
    region = value;
  }

  if (
    region !== -1 &&
    endX !== -1 &&
    (delimiters[region]!.lineOnly || endX !== (lines[line] ?? '').length + 1)
  ) {
    return line;
  }
  if (region === -1) return -1;

  for (let i = line + 1; i < lines.length; i++) {
    if (cache[i]!.length < 1 || cache[i]![0]![1] !== -1) continue;
    endX = cache[i]![0]![0];
    if ((lines[i] ?? '').length > 0 && endX !== (lines[i] ?? '').length + 1) return i;
  }
  return -1;
}

/**
 * `CodeEdit::_update_code_region_tags` (`code_edit.cpp:3186-3207`): `#region` and `#endregion` from the
 * shortest single-line comment delimiter, since the loop runs the length-sorted table backwards. With
 * no such delimiter both tags are empty, so a scene that clears `delimiter_comments` folds no region.
 */
export function codeRegionStrings(delimiters: readonly Delimiter[]): {
  start: string;
  end: string;
} {
  for (let i = delimiters.length - 1; i >= 0; i--) {
    const d = delimiters[i]!;
    if (d.type !== 'comment') continue;
    if (d.endKey.length === 0 && d.lineOnly) {
      return { start: `${d.startKey}region`, end: `${d.startKey}endregion` };
    }
  }
  return { start: '', end: '' };
}
