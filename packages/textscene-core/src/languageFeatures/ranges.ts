/**
 * Line and character arithmetic shared by the language features: where a heading
 * attribute value sits, where a property's key and value sit, and which word a cursor
 * is on. All offsets are zero-based characters within one line, the unit the parser's
 * one-based line numbers combine with at the boundary.
 */

import type { Range } from './types.js';

/** A span on one line, with the line given separately. */
export interface LineSpan {
  readonly start: number;
  readonly end: number;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The span of a heading attribute's quoted value, and the value itself. `key` is matched
 * whole, so `type` never matches `instance_type`. Godot quotes every scalar heading
 * attribute, so an unquoted `key=` yields nothing.
 */
export function headingAttribute(
  line: string,
  key: string
): { readonly span: LineSpan; readonly value: string } | undefined {
  const match = new RegExp(`(?:^|\\s|\\[)${escapeRegExp(key)}\\s*=\\s*"([^"]*)"`).exec(line);
  if (!match || match.index === undefined) return undefined;
  const value = match[1] ?? '';
  // The content starts after the opening quote, which is the last `"` before the value.
  const valueStart = line.indexOf(`"${value}"`, match.index);
  if (valueStart === -1) return undefined;
  const start = valueStart + 1;
  return { span: { start, end: start + value.length }, value };
}

/** Where the first `=` sits, or -1. A property's key is left of it, its value right. */
function equalsIndex(line: string): number {
  return line.indexOf('=');
}

/** The trimmed key of a property line and its span, or undefined when the line has no `=`. */
export function propertyKeySpan(line: string): { readonly span: LineSpan; readonly key: string } | undefined {
  const equals = equalsIndex(line);
  if (equals === -1) return undefined;
  const rawKey = line.slice(0, equals);
  const key = rawKey.trim();
  if (key.length === 0) return undefined;
  const start = rawKey.length - rawKey.trimStart().length;
  return { span: { start, end: start + key.length }, key };
}

/** The trimmed value of a property line and its span, or undefined when the line has no `=`. */
export function propertyValueSpan(
  line: string
): { readonly span: LineSpan; readonly value: string } | undefined {
  const equals = equalsIndex(line);
  if (equals === -1) return undefined;
  const rawValue = line.slice(equals + 1);
  const value = rawValue.trim();
  const start = equals + 1 + (rawValue.length - rawValue.trimStart().length);
  return { span: { start, end: start + value.length }, value };
}

/** A one-line {@link Range} at `line`. */
export function lineRange(line: number, span: LineSpan): Range {
  return { start: { line, character: span.start }, end: { line, character: span.end } };
}
