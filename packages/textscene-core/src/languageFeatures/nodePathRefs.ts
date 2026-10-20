/**
 * The node paths a heading spells in `parent=`, `from=` and `to=`, and the `[node]` heading each
 * one names. Godot writes all three relative to the scene root and walks them with
 * `get_node_or_null` from there (`resource_format_text.cpp:204-211, 371-372`), so the seated
 * scene's one walk (`LanguageDocument.nodeSectionOfPath`) resolves them.
 */

import type { DocumentSection, LanguageDocument } from './document.js';
import { headingAttribute, lineRange, lineRangeContains } from './ranges.js';
import type { Position, Range } from './types.js';

/** The attributes of each heading tag that hold a node path. A Map, since a tag is free text: `constructor` must miss. */
const PATH_ATTRIBUTES: ReadonlyMap<string, readonly string[]> = new Map([
  ['node', ['parent']],
  ['connection', ['from', 'to']],
]);

/** A node path as written, and where its value sits. */
export interface NodePathReference {
  readonly path: string;
  readonly range: Range;
}

/** The path references that resolve to each node heading, in line order. */
type NodeUses = ReadonlyMap<DocumentSection, readonly NodePathReference[]>;

/** Written only by {@link nodeUsesOf}. An entry lives as long as its document. */
const nodeUsesByDocument = new WeakMap<LanguageDocument, NodeUses>();

/** The node paths a heading line spells. */
function referencesOnHeading(section: DocumentSection, lineText: string): NodePathReference[] {
  const line = section.headingLine - 1;
  return (PATH_ATTRIBUTES.get(section.tag) ?? []).flatMap((key) => {
    const attribute = headingAttribute(lineText, key);
    return attribute ? [{ path: attribute.value, range: lineRange(line, attribute.span) }] : [];
  });
}

function buildNodeUses(document: LanguageDocument): NodeUses {
  const usesByNode = new Map<DocumentSection, NodePathReference[]>();
  for (const section of document.sections) {
    for (const reference of referencesOnHeading(section, document.lines[section.headingLine - 1] ?? '')) {
      const node = document.nodeSectionOfPath(reference.path);
      if (!node) continue;
      const uses = usesByNode.get(node) ?? [];
      uses.push(reference);
      usesByNode.set(node, uses);
    }
  }
  return usesByNode;
}

function nodeUsesOf(document: LanguageDocument): NodeUses {
  let uses = nodeUsesByDocument.get(document);
  if (!uses) {
    uses = buildNodeUses(document);
    nodeUsesByDocument.set(document, uses);
  }
  return uses;
}

/** Every `parent=`, `from=` and `to=` value that resolves to `node`, in line order. */
export function nodeUses(document: LanguageDocument, node: DocumentSection): readonly NodePathReference[] {
  return nodeUsesOf(document).get(node) ?? [];
}

/** The node path whose value the cursor is on, or undefined. */
export function nodePathReferenceAt(
  document: LanguageDocument,
  position: Position
): NodePathReference | undefined {
  const section = document.sectionAt(position.line + 1);
  if (section?.headingLine !== position.line + 1) return undefined;
  return referencesOnHeading(section, document.lines[position.line] ?? '').find(({ range }) =>
    lineRangeContains(range, position.character)
  );
}

/** The `name=` value of a node heading, or undefined. */
export function nodeNameRange(document: LanguageDocument, section: DocumentSection): Range | undefined {
  const line = section.headingLine - 1;
  const attribute = headingAttribute(document.lines[line] ?? '', 'name');
  return attribute && lineRange(line, attribute.span);
}

/** The node whose `name=` or path value the cursor is on, or undefined. */
export function nodeAt(document: LanguageDocument, position: Position): DocumentSection | undefined {
  const reference = nodePathReferenceAt(document, position);
  if (reference) return document.nodeSectionOfPath(reference.path);
  const section = document.sectionAt(position.line + 1);
  if (section?.tag !== 'node' || section.headingLine !== position.line + 1) return undefined;
  const name = nodeNameRange(document, section);
  return name && lineRangeContains(name, position.character) ? section : undefined;
}
