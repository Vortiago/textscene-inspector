/**
 * Navigation targets in one file: the declaration heading a resource id names, and every
 * `res://` path with the span it fills. A host resolves a path to a file against its own
 * project root, since that needs a filesystem.
 */

import type { LanguageDocument } from './document.js';
import { lineRange, lineRangeContains } from './ranges.js';
import { declarationOf, referenceAt } from './resourceRefs.js';
import type { Position, Range } from './types.js';

/** A `res://` occurrence and the span it fills. */
export interface ResPathOccurrence {
  readonly path: string;
  readonly range: Range;
}

/**
 * A `res://` path that opens a string runs to the closing quote, since a Godot file name can hold
 * a space or a parenthesis. A backslash ends it too, before the escaped quote of an inner string.
 * A path inside prose ends at the first space, quote or closing parenthesis.
 */
const RES_PATH_RE = /(?<=")res:\/\/[^"\\]+|(?<!")res:\/\/[^"'\s)\\]+/g;

/** The `res://` occurrences on one zero-based line. */
function resPathsOnLine(line: string, lineIndex: number): ResPathOccurrence[] {
  return [...line.matchAll(RES_PATH_RE)].map((match) => ({
    path: match[0],
    range: lineRange(lineIndex, { start: match.index, end: match.index + match[0].length }),
  }));
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
