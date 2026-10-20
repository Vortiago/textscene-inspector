/**
 * Highlights every occurrence of the name under the cursor. A resource id marks its
 * `ExtResource("…")` or `SubResource("…")` uses and the `id=` on its declaration heading. A node
 * marks its `name=` and every `parent=`, `from=` and `to=` path that resolves to it. One file's
 * names, so the answer needs no workspace.
 */

import type { LanguageDocument } from './document.js';
import { nodeAt, nodeNameRange, nodeUses } from './nodePathRefs.js';
import { headingAttribute, lineRange } from './ranges.js';
import { declarationOf, referenceAt, resourceReferences } from './resourceRefs.js';
import type { DocumentHighlight, Position } from './types.js';

/** The node's `name=` and every path value that resolves to it, in line order. */
function nodeHighlights(document: LanguageDocument, position: Position): readonly DocumentHighlight[] {
  const node = nodeAt(document, position);
  const name = node && nodeNameRange(document, node);
  if (!node || !name) return [];
  return [{ range: name }, ...nodeUses(document, node)].sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character
  );
}

/** Every span naming the id or node at a zero-based position, the declaration included. */
export function documentHighlights(
  document: LanguageDocument,
  position: Position
): readonly DocumentHighlight[] {
  const reference = referenceAt(document, position);
  if (!reference) return nodeHighlights(document, position);

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
