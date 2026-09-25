/**
 * CodeHighlighter decode: property bag to colour data. Its seven `ADD_PROPERTY` calls
 * (`syntax_highlighter.cpp:604-611`) are four Colors and three `String;Color` dictionaries,
 * and `SyntaxHighlighter` adds none. `font_color` (the TextEdit theme's, `:420-422`) and
 * `uint_suffix_enabled` are members with no property (`syntax_highlighter.h:89,95`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { colorOr, parseColorOrUndefined, type Color } from '../../../utils/colorParser';
import { unquoteString } from '../../../parser/utils';
import type { CodeHighlighterColorRegion, CodeHighlighterData } from './types';

const DEFAULT_COLOR: Color = { r: 0, g: 0, b: 0, a: 1 };

const DICT_WRAPPER_RE = /^\s*\{([\s\S]*)\}\s*$/;

/** Depth- and quote-aware comma split: a `Color(...)` value's own commas must not split an entry. */
function splitTopLevelEntries(body: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      entries.push(body.slice(start, i));
      start = i + 1;
    }
  }
  const last = body.slice(start).trim();
  if (last !== '') entries.push(last);
  return entries.map((e) => e.trim()).filter((e) => e !== '');
}

/** One `"key": value` entry into its raw (still-quoted) key and its raw value text, or `null` if the key half is not a quoted string. */
function splitKeyValue(entry: string): [rawKey: string, rawValue: string] | null {
  if (entry[0] !== '"') return null;
  let i = 1;
  for (; i < entry.length; i++) {
    if (entry[i] === '\\') {
      i++;
      continue;
    }
    if (entry[i] === '"') break;
  }
  if (i >= entry.length) return null;
  const rawKey = entry.slice(0, i + 1);
  const rest = entry.slice(i + 1).trimStart();
  if (rest[0] !== ':') return null;
  return [rawKey, rest.slice(1).trim()];
}

/**
 * `{ "key": Color(...), … }` into ordered, unescaped `[key, Color]` pairs:
 * `VariantParser::_parse_dictionary` (`core/variant/variant_parser.cpp:677-684`)
 * for the `String;Color` shape. A value that fails `COLOR_RE` drops that entry,
 * not the map: the strict parser already owns grammar errors.
 */
function decodeColorDictionary(raw: string | undefined): Array<[string, Color]> {
  if (!raw) return [];
  const wrapper = DICT_WRAPPER_RE.exec(raw);
  if (!wrapper) return [];
  const body = wrapper[1]!.trim();
  if (body === '') return [];
  const pairs: Array<[string, Color]> = [];
  for (const entry of splitTopLevelEntries(body)) {
    const split = splitKeyValue(entry);
    if (!split) continue;
    const [rawKey, rawValue] = split;
    const color = parseColorOrUndefined(rawValue);
    if (color === undefined) continue;
    pairs.push([unquoteString(rawKey), color]);
  }
  return pairs;
}

function colorEquals(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/**
 * `CodeHighlighter::add_keyword_color` and `add_member_keyword_color` add
 * unconditionally: a keyword gets no validation, unlike a color region's keys.
 */
function decodeKeywordColors(raw: string | undefined): ReadonlyMap<string, Color> {
  return new Map(decodeColorDictionary(raw));
}

/** The `is_symbol` class (mirrors `isGodotSymbol`, `core/string/char_utils.h:113-114`). */
function isSymbolChar(ch: string): boolean {
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

/**
 * `CodeHighlighter::add_color_region` (`syntax_highlighter.cpp:490-516`): refuses
 * an empty or non-symbol key and a duplicate `startKey`. It inserts after every
 * strictly longer `startKey`, so equal lengths end up in reverse dictionary order.
 */
function addColorRegion(regions: CodeHighlighterColorRegion[], startKey: string, endKey: string, color: Color): void {
  if (startKey === '') return;
  for (const ch of startKey) if (!isSymbolChar(ch)) return;
  for (const ch of endKey) if (!isSymbolChar(ch)) return;
  let at = 0;
  for (const region of regions) {
    if (region.startKey === startKey) return; // A duplicate refuses the whole call.
    if (startKey.length < region.startKey.length) at++;
  }
  regions.splice(at, 0, { startKey, endKey, color, lineOnly: endKey === '' });
}

/**
 * `CodeHighlighter::set_color_regions` (`syntax_highlighter.cpp:537-549`): a
 * dictionary key is `"start_key[ end_key]"`, split on the first space only
 * (`String::get_slicec(' ', 0)`/`(' ', 1)`): `end_key` drops a second space and
 * anything past it.
 */
function decodeColorRegions(raw: string | undefined): readonly CodeHighlighterColorRegion[] {
  const regions: CodeHighlighterColorRegion[] = [];
  for (const [key, color] of decodeColorDictionary(raw)) {
    const parts = key.split(' ');
    const startKey = parts[0]!;
    const endKey = parts.length > 1 ? parts[1]! : '';
    addColorRegion(regions, startKey, endKey, color);
  }
  return regions;
}

export function decodeCodeHighlighter(properties: Record<string, string>): CodeHighlighterData {
  return {
    keywordColors: decodeKeywordColors(properties.keyword_colors),
    memberKeywordColors: decodeKeywordColors(properties.member_keyword_colors),
    colorRegions: decodeColorRegions(properties.color_regions),
    numberColor: colorOr(properties.number_color, DEFAULT_COLOR),
    symbolColor: colorOr(properties.symbol_color, DEFAULT_COLOR),
    functionColor: colorOr(properties.function_color, DEFAULT_COLOR),
    memberVariableColor: colorOr(properties.member_variable_color, DEFAULT_COLOR),
  };
}

export { colorEquals, DEFAULT_COLOR };
