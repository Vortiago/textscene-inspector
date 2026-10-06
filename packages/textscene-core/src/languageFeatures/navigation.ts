/**
 * Navigation targets in one file: the declaration heading a resource id names, and every
 * `res://` path with the span it fills. A host resolves a path to a file against its own
 * project root, since that needs a filesystem.
 */

import { RES_PATH_BODY_SOURCE } from '../godot/string.js';
import type { LanguageDocument } from './document.js';
import { lineRange, lineRangeContains } from './ranges.js';
import { declarationOf, referenceAt } from './resourceRefs.js';
import type { Position, Range } from './types.js';

/** A `res://` occurrence and the span it fills. */
export interface ResPathOccurrence {
  readonly path: string;
  readonly range: Range;
}

const RES_PATH_RE = new RegExp(`res://${RES_PATH_BODY_SOURCE}`, 'g');

/** Where a path inside prose ends, since a path that opens no string has no closing quote. */
const PROSE_PATH_END_RE = /[\s')]/;

/** A path that opens a string runs as far as a file name may. One inside prose ends sooner. */
function pathText(line: string, match: RegExpExecArray): string {
  if (line[match.index - 1] === '"') return match[0];
  return match[0].split(PROSE_PATH_END_RE, 1)[0]!;
}

/** The `res://` occurrences on one zero-based line. */
function resPathsOnLine(line: string, lineIndex: number): ResPathOccurrence[] {
  return [...line.matchAll(RES_PATH_RE)].map((match) => {
    const path = pathText(line, match);
    return { path, range: lineRange(lineIndex, { start: match.index, end: match.index + path.length }) };
  });
}

/** Every `res://` occurrence in the document, in line order. */
export function resPathOccurrences(document: LanguageDocument): readonly ResPathOccurrence[] {
  return [...document.lines.entries()].flatMap(([lineIndex, line]) => resPathsOnLine(line, lineIndex));
}

/** The `res://` path the cursor sits on, or undefined. */
export function resPathAt(document: LanguageDocument, position: Position): ResPathOccurrence | undefined {
  const line = document.lines[position.line];
  if (line === undefined) return undefined;
  return resPathsOnLine(line, position.line).find(({ range }) =>
    lineRangeContains(range, position.character)
  );
}

/**
 * The whole heading line that declares the resource id under the cursor, or undefined. A cursor
 * on a declaration's own `id=` resolves to that heading.
 */
export function declarationRangeAt(document: LanguageDocument, position: Position): Range | undefined {
  const reference = referenceAt(document, position);
  const declaration = reference && declarationOf(document, reference);
  if (!declaration) return undefined;
  const line = declaration.headingLine - 1;
  return {
    start: { line, character: 0 },
    end: { line, character: document.lines[line]?.length ?? 0 },
  };
}
