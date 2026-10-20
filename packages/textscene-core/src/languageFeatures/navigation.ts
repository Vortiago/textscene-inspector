/**
 * Navigation targets in one file: the declaration heading a resource id names, the `[node]`
 * heading a node path names, and every `res://` path with the span it fills. A host resolves a
 * path to a file against its own project root, since that needs a filesystem.
 */

import { RES_PATH_BODY_SOURCE } from '../godot/string/string.js';
import type { DocumentSection, LanguageDocument } from './document.js';
import { nodePathReferenceAt } from './nodePathRefs.js';
import { nodeSectionOfPath } from './nodeSeating.js';
import { lineRange, lineRangeContains, linesRange } from './ranges.js';
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

/** The whole line of a section's heading. */
function headingRange(document: LanguageDocument, section: DocumentSection): Range {
  return linesRange(document, section.headingLine - 1, section.headingLine - 1);
}

/**
 * The whole heading line that declares the resource id under the cursor, or undefined. A cursor
 * on a declaration's own `id=` resolves to that heading.
 */
function declarationRangeAt(document: LanguageDocument, position: Position): Range | undefined {
  const reference = referenceAt(document, position);
  const declaration = reference && declarationOf(document, reference);
  return declaration && headingRange(document, declaration);
}

/**
 * The whole `[node]` heading line that the node path under the cursor names, or undefined. The
 * path is a `parent=`, `from=` or `to=` value, and a path into instanced content names none.
 */
function nodeDeclarationRangeAt(document: LanguageDocument, position: Position): Range | undefined {
  const reference = nodePathReferenceAt(document, position);
  const section = reference && nodeSectionOfPath(document, reference.path);
  return section && headingRange(document, section);
}

/** The heading line a resource id or a node path under the cursor names, or undefined. */
export function definitionRangeAt(document: LanguageDocument, position: Position): Range | undefined {
  return declarationRangeAt(document, position) ?? nodeDeclarationRangeAt(document, position);
}
