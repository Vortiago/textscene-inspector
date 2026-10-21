/**
 * The node paths a heading spells in `parent=`, `from=` and `to=`, and the `[node]` heading each
 * one names. The loader stores a `parent=` as written (`resource_format_text.cpp:205-212`) and a
 * connection end simplified (`:370-371`). Instantiate walks each from the scene root with
 * `get_node_or_null` (`packed_scene.cpp:157-165`), so the seated scene's one walk resolves them.
 */

import { simplifiedNodePath } from '../godot/string/nodePath.js';
import type { DocumentSection, LanguageDocument } from './document.js';
import { nodeSectionOfPath } from './nodeSeating.js';
import { headingAttribute, lineRange, lineRangeContains } from './ranges.js';
import type { Position, Range } from './types.js';

/** The attributes of each heading tag that hold a node path. A Map, since a tag is free text: `constructor` must miss. */
const PATH_ATTRIBUTES: ReadonlyMap<string, readonly string[]> = new Map([
  ['node', ['parent']],
  ['connection', ['from', 'to']],
]);

/** A node path as the loader stores it, and where its written value sits. */
interface NodePathReference {
  readonly path: string;
  readonly range: Range;
}

/** The path references that resolve to each node heading, in line order. */
type NodeUses = ReadonlyMap<DocumentSection, readonly NodePathReference[]>;

/** Written only by {@link nodeUsesOf}. An entry lives as long as its document. */
const nodeUsesByDocument = new WeakMap<LanguageDocument, NodeUses>();

/** The path the loader stores for a written value: it simplifies a connection end and nothing else. */
function storedPath(tag: string, written: string): string {
  return tag === 'connection' ? simplifiedNodePath(written) : written;
}

/** The node paths a heading line spells. */
function referencesOnHeading(section: DocumentSection, lineText: string): NodePathReference[] {
  const line = section.headingLine - 1;
  return (PATH_ATTRIBUTES.get(section.tag) ?? []).flatMap((key) => {
    const attribute = headingAttribute(lineText, key);
    if (!attribute) return [];
    return [{ path: storedPath(section.tag, attribute.value), range: lineRange(line, attribute.span) }];
  });
}

function buildNodeUses(document: LanguageDocument): NodeUses {
  const usesByNode = new Map<DocumentSection, NodePathReference[]>();
  for (const section of document.sections) {
    for (const reference of referencesOnHeading(section, document.lines[section.headingLine - 1] ?? '')) {
      const node = nodeSectionOfPath(document, reference.path);
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
  if (reference) return nodeSectionOfPath(document, reference.path);
  const section = document.sectionAt(position.line + 1);
  if (section?.tag !== 'node' || section.headingLine !== position.line + 1) return undefined;
  const name = nodeNameRange(document, section);
  return name && lineRangeContains(name, position.character) ? section : undefined;
}
