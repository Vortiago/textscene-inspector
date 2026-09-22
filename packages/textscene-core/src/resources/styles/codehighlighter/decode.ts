/**
 * CodeHighlighter decode — property bag in, per-branch colour data out.
 *
 * The seven real `ADD_PROPERTY` calls (`syntax_highlighter.cpp:604-611`):
 * four scalar Colors, plus `keyword_colors`/`member_keyword_colors`/
 * `color_regions`, each a `Dictionary(PROPERTY_HINT_TYPE_STRING, "String;Color")`.
 * `SyntaxHighlighter` itself (`syntax_highlighter.h`) adds no property at all.
 *
 * `font_color` — the algorithm's own default colour, `highlight.ts`'s
 * `fontColor` parameter — and `uint_suffix_enabled` are real class members
 * (`syntax_highlighter.h:89,95`) with NO `ADD_PROPERTY`: `font_color` is
 * copied from the owning TextEdit's OWN theme colour at `_update_cache`
 * (`:420-422`), and `uint_suffix_enabled` has a setter bound as a method but
 * never `ADD_PROPERTY`'d. Neither can a `.tscn` ever set, so neither is
 * decoded here.
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

/** Depth/quote-aware top-level comma split — a `Color(...)` value's own commas must not split an entry. */
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
 * `{ "key": Color(...), … }` into ordered, unescaped `[key, Color]` pairs —
 * `VariantParser::_parse_dictionary` (`core/variant/variant_parser.cpp:677-684`)
 * restricted to this property family's own `String;Color` shape. A value that
 * fails `COLOR_RE` drops that one entry rather than the whole map: the
 * surrounding `.tscn` text was already accepted by the strict parser upstream
 * of this decode, so a malformed Color here can only be a corrupt-but-parsed
 * literal, not a grammar violation this decode is responsible for rejecting.
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
 * `CodeHighlighter::add_keyword_color`/`add_member_keyword_color` add
 * unconditionally — no symbol-only or non-empty validation exists for a
 * keyword string, unlike a color region's start/end key.
 */
function decodeKeywordColors(raw: string | undefined): ReadonlyMap<string, Color> {
  return new Map(decodeColorDictionary(raw));
}

/**
 * `CodeHighlighter::add_color_region` (`syntax_highlighter.cpp:490-516`):
 * refuses a key that is empty of, or contains a character outside, the
 * `is_symbol` class (mirrors `isGodotSymbol`, `core/string/char_utils.h:113-114`),
 * refuses a duplicate `startKey`, and otherwise inserts before every EXISTING
 * region whose own `startKey` is STRICTLY LONGER — so the final order is
 * longest-`startKey`-first, with equal lengths ending up reversed from
 * dictionary order (each new equal-length entry lands in front of the ones
 * already placed, since none of them is counted as "longer").
 */
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

function addColorRegion(regions: CodeHighlighterColorRegion[], startKey: string, endKey: string, color: Color): void {
  if (startKey === '') return;
  for (const ch of startKey) if (!isSymbolChar(ch)) return;
  for (const ch of endKey) if (!isSymbolChar(ch)) return;
  let at = 0;
  for (const region of regions) {
    if (region.startKey === startKey) return; // duplicate — the whole call refuses.
    if (startKey.length < region.startKey.length) at++;
  }
  regions.splice(at, 0, { startKey, endKey, color, lineOnly: endKey === '' });
}

/**
 * `CodeHighlighter::set_color_regions` (`syntax_highlighter.cpp:537-549`): a
 * dictionary key is `"start_key[ end_key]"`, split on the FIRST space only
 * (`String::get_slicec(' ', 0)`/`(' ', 1)` — a second space and anything past
 * it is dropped from `end_key`, never appended).
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
