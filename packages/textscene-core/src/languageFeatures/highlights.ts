/**
 * Highlights every occurrence of the resource id under the cursor: its `ExtResource("…")`
 * or `SubResource("…")` uses and the `id=` on its declaration heading. One file's ids, so
 * the answer needs no workspace.
 */

import type { LanguageDocument } from './document.js';
import { lineRange, headingAttribute } from './ranges.js';
import { declarationOf, referenceAt, resourceReferences } from './resourceRefs.js';
import type { DocumentHighlight, Position } from './types.js';

/** Every span naming the id at a zero-based position, the declaration included. */
export function documentHighlights(
  document: LanguageDocument,
  position: Position
): readonly DocumentHighlight[] {
  const reference = referenceAt(document, position.line, position.character);
  if (!reference) return [];

  const highlights: DocumentHighlight[] = [];
  for (const span of resourceReferences(document)) {
    if (span.kind === reference.kind && span.id === reference.id) highlights.push({ range: span.range });
  }

  const declaration = declarationOf(document, reference);
  if (declaration) {
    const line = document.lines[declaration.headingLine - 1] ?? '';
    const attribute = headingAttribute(line, 'id');
    if (attribute) highlights.push({ range: lineRange(declaration.headingLine - 1, attribute.span) });
  }
  return highlights;
}
