/**
 * Line and character arithmetic shared by the language features: where a heading
 * attribute value sits, where a property's key and value sit, and whether a cursor is on
 * a span. All offsets are zero-based characters within one line, the unit the parser's
 * one-based line numbers combine with at the boundary.
 */

import { parseHeading } from '../parser/utils.js';
import type { Range } from './types.js';

/** A span on one line, with the line given separately. */
interface LineSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * The span of a heading attribute's value, inside its quotes when it has them, and the
 * value itself. The parser's scanner finds both, so a `type=B` inside `name="A type=B"`
 * is text of the name, not an attribute. Godot quotes every string attribute, and a
 * pre-4.0 scene writes an integer `id=1` bare.
 */
export function headingAttribute(
  line: string,
  key: string
): { readonly span: LineSpan; readonly value: string } | undefined {
  const heading = parseHeading(line);
  const span = heading?.valueSpans[key];
  const value = heading?.attributes[key];
  return span === undefined || value === undefined ? undefined : { span, value };
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

/** Whether `character` lies on `span`, both ends included, so a cursor just past the end counts. */
export function spanContains(span: LineSpan, character: number): boolean {
  return character >= span.start && character <= span.end;
}

/** Whether `character` lies on a one-line range, both ends included. */
export function lineRangeContains(range: Range, character: number): boolean {
  return character >= range.start.character && character <= range.end.character;
}

/** A one-line {@link Range} at `line`. */
export function lineRange(line: number, span: LineSpan): Range {
  return { start: { line, character: span.start }, end: { line, character: span.end } };
}
