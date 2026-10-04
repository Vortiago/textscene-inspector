/**
 * Navigation targets: a resource id resolves to its declaration heading, and a `res://` path
 * names a project file. The path half returns what and where it is. The server resolves the
 * file against the project root, since that needs the filesystem.
 */

import type { Location, Position, Range } from 'vscode-languageserver/node';
import {
  declaredResourceIds,
  resourceReferences,
  type LanguageDocument,
} from '@textscene/core/languageFeatures';

/** A `res://` occurrence and the span it fills. */
export interface ResPathOccurrence {
  readonly path: string;
  readonly range: Range;
}

/** Matches a `res://` reference up to the next quote, whitespace, or closing paren. */
const RES_PATH_PATTERN = /res:\/\/[^"'\s)]+/g;

function wholeLineRange(document: LanguageDocument, lineIndex: number): Range {
  const length = document.lines[lineIndex]?.length ?? 0;
  return { start: { line: lineIndex, character: 0 }, end: { line: lineIndex, character: length } };
}

/** The `ExtResource` or `SubResource` reference the cursor sits on. */
function referenceAtPosition(
  document: LanguageDocument,
  position: Position
): { readonly kind: 'ext' | 'sub'; readonly id: string } | undefined {
  for (const reference of resourceReferences(document)) {
    if (
      reference.range.start.line === position.line &&
      position.character >= reference.range.start.character &&
      position.character <= reference.range.end.character
    ) {
      return { kind: reference.kind, id: reference.id };
    }
  }
  return undefined;
}

/** The declaration heading of the resource id under the cursor, or undefined. */
export function resourceIdLocation(
  document: LanguageDocument,
  position: Position,
  uri: string
): Location | undefined {
  const reference = referenceAtPosition(document, position);
  if (!reference) return undefined;
  const declaration = declaredResourceIds(document).get(`${reference.kind}:${reference.id}`);
  if (!declaration) return undefined;
  return { uri, range: wholeLineRange(document, declaration.headingLine - 1) };
}

/** The `res://` path the cursor sits on, or undefined. */
export function resPathAt(document: LanguageDocument, position: Position): ResPathOccurrence | undefined {
  const line = document.lines[position.line];
  if (line === undefined) return undefined;
  RES_PATH_PATTERN.lastIndex = 0;
  for (let match = RES_PATH_PATTERN.exec(line); match !== null; match = RES_PATH_PATTERN.exec(line)) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return {
        path: match[0],
        range: {
          start: { line: position.line, character: start },
          end: { line: position.line, character: end },
        },
      };
    }
  }
  return undefined;
}

/** Every `res://` occurrence in the document, in line order. */
export function resourceLinks(document: LanguageDocument): readonly ResPathOccurrence[] {
  const found: ResPathOccurrence[] = [];
  for (const [lineIndex, line] of document.lines.entries()) {
    RES_PATH_PATTERN.lastIndex = 0;
    for (let match = RES_PATH_PATTERN.exec(line); match !== null; match = RES_PATH_PATTERN.exec(line)) {
      const start = match.index;
      const end = start + match[0].length;
      found.push({
        path: match[0],
        range: { start: { line: lineIndex, character: start }, end: { line: lineIndex, character: end } },
      });
    }
  }
  return found;
}
