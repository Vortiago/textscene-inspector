export interface ParsedHeading {
  type: string;
  attributes: Record<string, string>;
}

export function parseHeading(line: string): ParsedHeading | null {
  const trimmed = line.trim();

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const content = trimmed.slice(1, -1).trim();

  const spaceIndex = content.indexOf(' ');
  if (spaceIndex === -1) {
    return { type: content, attributes: {} };
  }

  const type = content.slice(0, spaceIndex);
  const attributesStr = content.slice(spaceIndex + 1);

  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)=("(?:[^"\\]|\\.)*"|[^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attributesStr)) !== null) {
    const key = match[1];
    let value = match[2];

    if (!key || !value) continue;

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
      value = value.replace(/\\"/g, '"');
    }

    attributes[key] = value;
  }

  return { type, attributes };
}

export function parseProperty(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith(';')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  return { key, value };
}

export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

export function isComment(line: string): boolean {
  return line.trim().startsWith(';');
}

export function isEmpty(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Count `"` characters that are real string delimiters — i.e. NOT escaped. A
 * quote is escaped only when preceded by an ODD number of consecutive
 * backslashes (`\"` is escaped; `\\"` is an escaped backslash followed by a
 * real quote). Shared by both parsers so they agree on string termination.
 */
export function countUnescapedQuotes(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '"') continue;
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) backslashes++;
    if (backslashes % 2 === 0) count++;
  }
  return count;
}

/**
 * True when a value opens a quoted string but hasn't closed it — Godot writes
 * multi-line strings (label text, descriptions) across several lines, and the
 * line-based property parser sees only the first fragment (odd quote count).
 */
export function isUnterminatedString(value: string): boolean {
  return value.startsWith('"') && countUnescapedQuotes(value) % 2 === 1;
}

/**
 * True when a property value isn't complete on this line. Godot writes
 * multi-line values both as unterminated strings (label text) AND as bracketed
 * arrays/dicts spanning lines — packed arrays and especially `SpriteFrames`
 * `animations = [{ … }]`. The line-based parsers must keep accumulating until
 * BOTH quotes and brackets balance, or the value is truncated to its first
 * fragment. Single string-aware scan: incomplete if a string is still open, or
 * `[`/`{` outnumber `]`/`}` outside strings.
 */
export function isIncompleteValue(value: string): boolean {
  let inString = false;
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (inString) {
      if (c === '\\') i++; // skip the escaped character
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  return inString || depth > 0;
}

const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  n: '\n',
  r: '\r',
  t: '\t',
};

/**
 * Strip a value's surrounding quotes and decode Godot's string escape sequences
 * (`\n`, `\t`, `\r`, `\\`, `\"`, plus `\uXXXX` / `\UXXXXXX` Unicode — Godot emits
 * those for non-ASCII characters). Non-quoted values pass through unchanged.
 * A single left-to-right pass so an escaped backslash (`\\u1234`) is decoded as
 * `\` + literal `u1234`, not as a Unicode escape. Used wherever a node parser
 * reads a string property (label/button text, …).
 */
export function unquoteString(value: string): string {
  let v = value;
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1);
  }
  return v.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{6}|["\\nrt])/g, (_match, seq: string) => {
    if (seq[0] === 'u' || seq[0] === 'U') {
      return String.fromCodePoint(parseInt(seq.slice(1), 16));
    }
    return ESCAPE_MAP[seq] ?? seq;
  });
}

/**
 * Parse a string property value to an int, or `undefined` when absent/invalid.
 * Shared by node parsers that read enum / count properties.
 */
export function intOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}
