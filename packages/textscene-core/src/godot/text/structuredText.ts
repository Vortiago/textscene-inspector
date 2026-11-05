/**
 * The structured-text parsers that split a text into bidi override ranges, so a path, an address or
 * a list keeps its parts in logical order whatever their script: `TextServer::parse_structured_text`
 * (`servers/text/text_server.cpp:2140-2290`), with the CUSTOM arm of `Control::structured_text_parser`
 * (`scene/gui/control.cpp:3523-3532`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { StructuredTextParser, TextDirection } from './textServerEnums.js';

/** `[start, end)` of the text and the `TextDirection` its bidi pass runs at: Godot's `Vector3i(start, end, direction)`. */
export interface StructuredTextRange {
  start: number;
  end: number;
  direction: number;
}

const AUTO = TextDirection.TEXT_DIRECTION_AUTO;
const LTR = TextDirection.TEXT_DIRECTION_LTR;
const INHERITED = TextDirection.TEXT_DIRECTION_INHERITED;

const URI_SEPARATORS = new Set(['\\', '/', '.', ':', '&', '=', '@', '?', '#']);
const FILE_SEPARATORS = new Set(['\\', '/', ':']);

/** `is_unicode_identifier_start`: Godot's `xid_start` table, which adds `_` (`core/string/char_range.inc:47`). */
const IDENTIFIER_START = /[\p{XID_Start}_]/u;
/** `is_unicode_identifier_continue` (`core/string/char_range.inc:733`). */
const IDENTIFIER_CONTINUE = /\p{XID_Continue}/u;

/** The URI and FILE arms: an AUTO range between separators, an LTR range of one character on each. */
function splitAtSeparators(text: string, separators: ReadonlySet<string>): StructuredTextRange[] {
  const ranges: StructuredTextRange[] = [];
  let prev = 0;
  for (let i = 0; i < text.length; i++) {
    if (!separators.has(text[i]!)) continue;
    if (prev !== i) ranges.push({ start: prev, end: i, direction: AUTO });
    ranges.push({ start: i, end: i + 1, direction: LTR });
    prev = i + 1;
  }
  if (prev !== text.length) ranges.push({ start: prev, end: text.length, direction: AUTO });
  return ranges;
}

/** The EMAIL arm: the local part whole up to the first `@`, then each `.`-separated domain part. */
function splitEmail(text: string): StructuredTextRange[] {
  const ranges: StructuredTextRange[] = [];
  let isLocal = true;
  let prev = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '@' && isLocal) {
      isLocal = false;
      ranges.push({ start: prev, end: i, direction: AUTO });
      ranges.push({ start: i, end: i + 1, direction: LTR });
      prev = i + 1;
    } else if (!isLocal && char === '.') {
      if (prev !== i) ranges.push({ start: prev, end: i, direction: AUTO });
      ranges.push({ start: i, end: i + 1, direction: LTR });
      prev = i + 1;
    }
  }
  if (prev !== text.length) ranges.push({ start: prev, end: text.length, direction: AUTO });
  return ranges;
}

/**
 * The LIST arm, transcribed with its quirks: `prev != i` compares a character offset with a part
 * index, and each separator range is one character wide, whatever the separator's length.
 */
function splitList(text: string, options: readonly unknown[]): StructuredTextRange[] {
  const separator = options[0];
  if (options.length !== 1 || typeof separator !== 'string') return [];
  const ranges: StructuredTextRange[] = [];
  let prev = 0;
  text.split(separator).forEach((part, i) => {
    if (prev !== i) ranges.push({ start: prev, end: prev + part.length, direction: INHERITED });
    ranges.push({ start: prev + part.length, end: prev + part.length + 1, direction: INHERITED });
    prev = prev + part.length + 1;
  });
  return ranges;
}

/**
 * The GDSCRIPT arm: identifiers, string literals with their `\` escapes and quotes, and a `#` comment
 * to the end. The character that ends an identifier is not read again, as in the engine's loop.
 */
function splitGdscript(text: string): StructuredTextRange[] {
  const ranges: StructuredTextRange[] = [];
  const pushAuto = (start: number, end: number): void => {
    if (start !== end) ranges.push({ start, end, direction: AUTO });
  };
  let quote: string | null = null;
  let isInIdentifier = false;
  let prev = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quote !== null) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        pushAuto(prev, i);
        prev = i + 1;
        ranges.push({ start: i, end: i + 1, direction: LTR });
        quote = null;
      }
    } else if (isInIdentifier) {
      if (!IDENTIFIER_CONTINUE.test(char)) {
        pushAuto(prev, i);
        prev = i;
        isInIdentifier = false;
      }
    } else if (IDENTIFIER_START.test(char)) {
      pushAuto(prev, i);
      prev = i;
      isInIdentifier = true;
    } else if (char === '"' || char === "'") {
      pushAuto(prev, i);
      prev = i + 1;
      ranges.push({ start: i, end: i + 1, direction: LTR });
      quote = char;
    } else if (char === '#') {
      pushAuto(prev, i);
      prev = text.length;
      ranges.push({ start: i, end: text.length, direction: AUTO });
      break;
    }
  }
  if (prev < text.length) ranges.push({ start: prev, end: text.length, direction: AUTO });
  return ranges;
}

/**
 * The override ranges of `parser` over `text`, with `options` as the `structured_text_bidi_override_options`
 * array. CUSTOM calls a script's `_structured_text_parser`, which no scene file holds, so it gives none.
 */
export function parseStructuredText(
  parser: number,
  options: readonly unknown[],
  text: string
): StructuredTextRange[] {
  switch (parser) {
    case StructuredTextParser.STRUCTURED_TEXT_URI:
      return splitAtSeparators(text, URI_SEPARATORS);
    case StructuredTextParser.STRUCTURED_TEXT_FILE:
      return splitAtSeparators(text, FILE_SEPARATORS);
    case StructuredTextParser.STRUCTURED_TEXT_EMAIL:
      return splitEmail(text);
    case StructuredTextParser.STRUCTURED_TEXT_LIST:
      return splitList(text, options);
    case StructuredTextParser.STRUCTURED_TEXT_GDSCRIPT:
      return splitGdscript(text);
    case StructuredTextParser.STRUCTURED_TEXT_CUSTOM:
      return [];
    default:
      return [{ start: 0, end: text.length, direction: INHERITED }];
  }
}
