/**
 * ThorVG's XML parser (`tvgXmlParser.cpp`, ThorVG 0.15.16 as Godot 4.6.3 ships it): the tags and
 * text of a document, the attributes of a tag, a `style` attribute's declarations and a CSS rule.
 * It works on the text Godot hands it, and keeps ThorVG's handling of entities, which it skips
 * rather than replaces.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */

/** `SimpleXMLType` (`tvgXmlParser.h:33-46`). */
export const SimpleXmlType = {
  Open: 0,
  OpenEmpty: 1,
  Close: 2,
  Data: 3,
  CData: 4,
  Error: 5,
  Processing: 6,
  Doctype: 7,
  Comment: 8,
  Ignored: 9,
  DoctypeChild: 10,
} as const;

export type SimpleXmlTypeValue = (typeof SimpleXmlType)[keyof typeof SimpleXmlType];

/** A node's type and its text, without the tag's brackets. False stops the parse. */
export type SimpleXmlCallback = (type: SimpleXmlTypeValue, content: string) => boolean;

/** An attribute's key and value. False marks an attribute the reader does not support, and the parse goes on. */
export type SimpleXmlAttributeCallback = (key: string, value: string) => boolean;

/** `xmlEntity` (`tvgXmlParser.h:29-30`): the entities the parser skips over. */
const XML_ENTITIES = [
  '&#10;',
  '&quot;',
  '&nbsp;',
  '&apos;',
  '&amp;',
  '&lt;',
  '&gt;',
  '&#035;',
  '&#039;',
] as const;

/** C's `isspace` in the C locale. */
export function isSpace(character: string | undefined): boolean {
  return (
    character === ' ' ||
    character === '\t' ||
    character === '\n' ||
    character === '\v' ||
    character === '\f' ||
    character === '\r'
  );
}

function findWhiteSpace(text: string, at: number, end: number): number {
  while (at < end && !isSpace(text[at])) at++;
  return at;
}

function skipWhiteSpace(text: string, at: number, end: number): number {
  while (at < end && isSpace(text[at])) at++;
  return at;
}

/** `_simpleXmlUnskipWhiteSpace`: the end of the text before the white space that ends at `at`. */
function unskipWhiteSpace(text: string, at: number, start: number): number {
  for (at--; at > start; at--) if (!isSpace(text[at])) break;
  return at + 1;
}

function skipXmlEntities(text: string, at: number, end: number): number {
  let previous = at;
  while (at < end && text[at] === '&') {
    for (const entity of XML_ENTITIES) {
      if (text.startsWith(entity, at)) {
        at += entity.length;
        break;
      }
    }
    if (at === previous) break;
    previous = at;
  }
  return at;
}

function unskipXmlEntities(text: string, at: number, start: number): number {
  let previous = at;
  while (at > start && text[at - 1] === ';') {
    for (const entity of XML_ENTITIES) {
      if (at - entity.length > start && text.startsWith(entity, at - entity.length)) {
        at -= entity.length;
        break;
      }
    }
    if (at === previous) break;
    previous = at;
  }
  return at;
}

function skipWhiteSpacesAndXmlEntities(text: string, at: number, end: number): number {
  at = skipWhiteSpace(text, at, end);
  let previous = at;
  for (;;) {
    at = skipXmlEntities(text, at, end);
    if (at === previous) break;
    previous = at;
    at = skipWhiteSpace(text, at, end);
    if (at === previous) break;
    previous = at;
  }
  return at;
}

function unskipWhiteSpacesAndXmlEntities(text: string, at: number, start: number): number {
  at = unskipWhiteSpace(text, at, start);
  let previous = at;
  for (;;) {
    at = unskipXmlEntities(text, at, start);
    if (at === previous) break;
    previous = at;
    at = unskipWhiteSpace(text, at, start);
    if (at === previous) break;
    previous = at;
  }
  return at;
}

/** `_simpleXmlFindEndTag`: the `>` or `<` that ends a tag outside its quotes, or -1. */
function findEndTag(text: string, at: number, end: number): number {
  let isInDoubleQuote = false;
  let isInSingleQuote = false;
  for (; at < end; at++) {
    if (text[at] === '"' && !isInSingleQuote) isInDoubleQuote = !isInDoubleQuote;
    if (text[at] === "'" && !isInDoubleQuote) isInSingleQuote = !isInSingleQuote;
    if (!isInDoubleQuote && !isInSingleQuote && (text[at] === '>' || text[at] === '<')) return at;
  }
  return -1;
}

/** The last character of the first `closing` at or after `at`, or -1. */
function findClosing(text: string, at: number, end: number, closing: string): number {
  const found = text.indexOf(closing, at);
  return found >= 0 && found + closing.length <= end ? found + closing.length - 1 : -1;
}

function findDoctypeChildEndTag(text: string, at: number, end: number): number {
  const found = text.indexOf('>', at);
  return found >= 0 && found < end ? found : -1;
}

/** `_getXMLType`: the type of the tag at `at`, and how many characters past its `<` its content starts. */
function xmlTypeAt(text: string, at: number, end: number): { type: SimpleXmlTypeValue; offset: number } {
  const next = text[at + 1];
  if (next === '/') return { type: SimpleXmlType.Close, offset: 1 };
  if (next === '?') return { type: SimpleXmlType.Processing, offset: 1 };
  if (next !== '!') return { type: SimpleXmlType.Open, offset: 0 };
  const afterDoctype = text[at + 2 + 'DOCTYPE'.length];
  if (
    at + '<!DOCTYPE>'.length - 1 < end &&
    text.startsWith('DOCTYPE', at + 2) &&
    (afterDoctype === '>' || isSpace(afterDoctype))
  )
    return { type: SimpleXmlType.Doctype, offset: '!DOCTYPE'.length };
  if (at + '<![CDATA[]]>'.length - 1 < end && text.startsWith('[CDATA[', at + 2))
    return { type: SimpleXmlType.CData, offset: '![CDATA['.length };
  if (at + '<!---->'.length - 1 < end && text.startsWith('--', at + 2))
    return { type: SimpleXmlType.Comment, offset: '!--'.length };
  if (at + '<!>'.length - 1 < end) return { type: SimpleXmlType.DoctypeChild, offset: '!'.length };
  return { type: SimpleXmlType.Open, offset: 0 };
}

/** `simpleXmlParse` (`tvgXmlParser.cpp:385-473`): false for a malformed document or a callback that stops. */
export function simpleXmlParse(text: string, strip: boolean, callback: SimpleXmlCallback): boolean {
  const end = text.length;
  let at = 0;
  while (at < end) {
    if (text[at] === '<') {
      if (at + 1 >= end) return false;
      const parsed = parseTag(text, at, end, strip, callback);
      if (parsed < 0) return false;
      at = parsed;
    } else {
      const parsed = parseData(text, at, end, strip, callback);
      if (parsed < 0) return false;
      at = parsed;
    }
  }
  return true;
}

/** Reads the tag at `at` and answers where the parse goes on, or -1 to stop. */
function parseTag(
  text: string,
  at: number,
  end: number,
  strip: boolean,
  callback: SimpleXmlCallback
): number {
  let { type, offset } = xmlTypeAt(text, at, end);
  const contentAt = at + 1 + offset;
  let closing: number;
  if (type === SimpleXmlType.CData) closing = findClosing(text, contentAt, end, ']]>');
  else if (type === SimpleXmlType.DoctypeChild) closing = findDoctypeChildEndTag(text, contentAt, end);
  else if (type === SimpleXmlType.Comment) closing = findClosing(text, contentAt, end, '-->');
  else closing = findEndTag(text, contentAt, end);
  if (closing < 0) return -1;
  if (text[closing] === '<' && type !== SimpleXmlType.Doctype) return -1;
  let start = contentAt;
  let contentEnd = closing;
  if (type === SimpleXmlType.Open && text[closing - 1] === '/') {
    type = SimpleXmlType.OpenEmpty;
    contentEnd--;
  } else if (type === SimpleXmlType.CData && text.startsWith(']]', closing - 2)) {
    contentEnd -= 2;
  } else if (type === SimpleXmlType.Processing && text[closing - 1] === '?') {
    contentEnd--;
  } else if (type === SimpleXmlType.Comment && text.startsWith('--', closing - 2)) {
    contentEnd -= 2;
  }
  if (strip && type !== SimpleXmlType.CData) {
    start = skipWhiteSpacesAndXmlEntities(text, start, contentEnd);
    contentEnd = unskipWhiteSpacesAndXmlEntities(text, contentEnd, start);
  }
  if (!callback(type, text.slice(start, Math.max(start, contentEnd)))) return -1;
  return closing + 1;
}

/** Reads the text at `at` up to the next tag, and answers where the parse goes on, or -1 to stop. */
function parseData(
  text: string,
  at: number,
  end: number,
  strip: boolean,
  callback: SimpleXmlCallback
): number {
  if (strip) {
    const skipped = skipWhiteSpacesAndXmlEntities(text, at, end);
    if (!callback(SimpleXmlType.Ignored, text.slice(at, skipped))) return -1;
    at = skipped;
  }
  let next = text.indexOf('<', at);
  if (next < 0) next = end;
  const dataEnd = strip ? unskipWhiteSpacesAndXmlEntities(text, next, at) : next;
  if (at !== dataEnd && !callback(SimpleXmlType.Data, text.slice(at, dataEnd))) return -1;
  if (strip && dataEnd < next && !callback(SimpleXmlType.Ignored, text.slice(dataEnd, next))) return -1;
  return next;
}

/**
 * `simpleXmlParseAttributes` (`tvgXmlParser.cpp:316-382`): each `key="value"` of a tag's attribute
 * text. An entity in a value is dropped, with the character after it kept. False for malformed text.
 */
export function simpleXmlParseAttributes(text: string, callback: SimpleXmlAttributeCallback): boolean {
  const end = text.length;
  let at = 0;
  while (at < end) {
    const key = skipWhiteSpacesAndXmlEntities(text, at, end);
    if (key === end) return true;
    let keyEnd = key;
    while (keyEnd < end && text[keyEnd] !== '=' && !isSpace(text[keyEnd])) keyEnd++;
    if (keyEnd === end) return false;
    if (keyEnd === key) {
      at = keyEnd + 1;
      continue;
    }
    let value: number;
    if (text[keyEnd] === '=') {
      value = keyEnd + 1;
    } else {
      const equals = text.indexOf('=', keyEnd);
      if (equals < 0) return false;
      value = equals + 1;
    }
    keyEnd = unskipXmlEntities(text, keyEnd, key);
    value = skipWhiteSpacesAndXmlEntities(text, value, end);
    if (value === end) return false;
    let valueEnd: number;
    const quote = text[value];
    if (quote === '"' || quote === "'") {
      valueEnd = text.indexOf(quote, value + 1);
      if (valueEnd < 0) return false;
      value++;
    } else {
      valueEnd = findWhiteSpace(text, value, end);
    }
    at = valueEnd + 1;
    value = skipWhiteSpacesAndXmlEntities(text, value, end);
    valueEnd = unskipWhiteSpacesAndXmlEntities(text, valueEnd, value);
    callback(text.slice(key, keyEnd), copiedValue(text, value, valueEnd));
  }
  return true;
}

/** The value ThorVG copies: each entity skipped, and the character after it taken, even the closing quote. */
function copiedValue(text: string, at: number, end: number): string {
  let value = '';
  while (at < end) {
    at = skipXmlEntities(text, at, end);
    value += text[at] ?? '';
    at++;
  }
  return value;
}

/**
 * `simpleXmlParseW3CAttribute` (`tvgXmlParser.cpp:476-545`): each `key: value` declaration of a
 * `style` attribute or a CSS rule, trimmed. A `src` before the colon skips one more semicolon.
 */
export function simpleXmlParseW3CAttribute(text: string, callback: SimpleXmlAttributeCallback): boolean {
  const end = text.length;
  if (end === 0) return true;
  let at = 0;
  for (;;) {
    const separator = text.indexOf(':', at);
    let next = text.indexOf(';', at);
    const source = text.indexOf('src', at);
    // A font face's `src` holds a semicolon of its own.
    if (source >= 0 && separator >= 0 && source < separator) {
      if (next < 0 || next + 1 >= end) return true;
      next = text.indexOf(';', next + 1);
    }
    let key = '';
    let value = '';
    if (separator >= 0 && next < 0) {
      key = text.slice(at, separator);
      value = text.slice(separator + 1, end);
    } else if (separator >= 0 && separator < next) {
      key = text.slice(at, separator);
      value = text.slice(separator + 1, next);
    } else if (next >= 0) {
      key = text.slice(at, next);
    }
    if (key) callback(key.replace(/^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/g, ''), trimmedValue(value));
    if (next < 0) break;
    at = next + 1;
  }
  return true;
}

/** `_simpleXmlUnskipWhiteSpace` keeps a value's first character, white or not, so a value of white space alone stays one character. */
function trimmedValue(value: string): string {
  const start = skipWhiteSpace(value, 0, value.length);
  return value.slice(start, Math.max(start, unskipWhiteSpace(value, value.length, start)));
}

/** A CSS rule: its tag (`all` for a class alone), its class name, its declarations, and where the next rule starts. */
export interface CssRule {
  readonly tag: string;
  readonly name: string | null;
  readonly declarations: string;
  readonly next: number;
}

/** `simpleXmlParseCSSAttribute` (`tvgXmlParser.cpp:552-588`): the rule at the start of `text`, or null. Formats: `tag {}`, `.name {}`, `tag.name {}`. */
export function simpleXmlParseCssAttribute(text: string): CssRule | null {
  const start = skipWhiteSpace(text, 0, text.length);
  let open = text.indexOf('{');
  if (open < 0 || start === open) return null;
  const close = text.indexOf('}', open);
  if (close < 0) return null;
  const declarations = text.slice(open + 1, close);
  open = unskipWhiteSpace(text, open, start);
  if (text[open - 1] === '.') return null;
  let dot = start;
  while (dot < open && text[dot] !== '.') dot++;
  return {
    tag: dot === start ? 'all' : text.slice(start, dot),
    name: dot === open ? null : text.slice(dot + 1, open),
    declarations,
    next: close + 1,
  };
}

/**
 * `simpleXmlFindAttributesTag` (`tvgXmlParser.cpp:591-606`): where a tag's attributes start after
 * its name, 0 for text that holds attributes alone, or -1 for a tag with none.
 */
export function simpleXmlFindAttributesTag(text: string): number {
  for (let at = 0; at < text.length; at++) {
    if (!isSpace(text[at])) {
      if (text[at] === '=') return 0;
    } else {
      return unskipXmlEntities(text, at, 0);
    }
  }
  return -1;
}
