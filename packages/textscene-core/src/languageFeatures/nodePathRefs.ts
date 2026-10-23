/**
 * The node paths a heading spells in `parent=`, `from=` and `to=`, and the `[node]` heading each
 * one names. The loader stores a `parent=` as written (`resource_format_text.cpp:205-212`).
 * Instantiate walks each from the scene root with `get_node_or_null` (`packed_scene.cpp:157-165`),
 * so the seated scene's one walk resolves it. A connection end falls back to its uid path there.
 */

import { parseIdTrail } from '../godot/scene/packedScene.js';
import type { DocumentSection, LanguageDocument } from './document.js';
import { nodeSectionOfConnectionEnd, nodeSectionOfPath } from './nodeSeating.js';
import { headingAttribute, lineRange, lineRangeContains } from './ranges.js';
import type { Position, Range } from './types.js';

/** A node path attribute of a heading, with the attribute that holds the id trail its end falls back to. */
interface PathAttribute {
  readonly key: string;
  readonly idTrailKey?: string;
}

/** The attributes of each heading tag that hold a node path. A Map, since a tag is free text: `constructor` must miss. */
const PATH_ATTRIBUTES: ReadonlyMap<string, readonly PathAttribute[]> = new Map([
  ['node', [{ key: 'parent' }]],
  [
    'connection',
    [
      { key: 'from', idTrailKey: 'from_uid_path' },
      { key: 'to', idTrailKey: 'to_uid_path' },
    ],
  ],
]);

/** A node path as the heading writes it, and where its value sits. */
interface NodePathReference {
  readonly path: string;
  readonly range: Range;
  /** The ids of the uid path a connection end falls back to. Undefined for a `parent=` and for an end with none. */
  readonly idTrail: readonly number[] | undefined;
  readonly isConnectionEnd: boolean;
}

/** The path references that resolve to each node heading, in line order. */
type NodeUses = ReadonlyMap<DocumentSection, readonly NodePathReference[]>;

/** Written only by {@link nodeUsesOf}. An entry lives as long as its document. */
const nodeUsesByDocument = new WeakMap<LanguageDocument, NodeUses>();

/** The node paths a heading line spells. */
function referencesOnHeading(section: DocumentSection, lineText: string): NodePathReference[] {
  const line = section.headingLine - 1;
  return (PATH_ATTRIBUTES.get(section.tag) ?? []).flatMap(({ key, idTrailKey }) => {
    const attribute = headingAttribute(lineText, key);
    if (!attribute) return [];
    return [
      {
        path: attribute.value,
        range: lineRange(line, attribute.span),
        idTrail: idTrailKey === undefined ? undefined : parseIdTrail(section.attributes[idTrailKey]),
        isConnectionEnd: idTrailKey !== undefined,
      },
    ];
  });
}

/** The `[node]` heading a reference names, or undefined where this file seats none there. */
export function nodeOfReference(
  document: LanguageDocument,
  { path, idTrail, isConnectionEnd }: NodePathReference
): DocumentSection | undefined {
  return isConnectionEnd
    ? nodeSectionOfConnectionEnd(document, path, idTrail)
    : nodeSectionOfPath(document, path);
}

function buildNodeUses(document: LanguageDocument): NodeUses {
  const usesByNode = new Map<DocumentSection, NodePathReference[]>();
  for (const section of document.sections) {
    for (const reference of referencesOnHeading(section, document.lines[section.headingLine - 1] ?? '')) {
      const node = nodeOfReference(document, reference);
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
  if (reference) return nodeOfReference(document, reference);
  const section = document.sectionAt(position.line + 1);
  if (section?.tag !== 'node' || section.headingLine !== position.line + 1) return undefined;
  const name = nodeNameRange(document, section);
  return name && lineRangeContains(name, position.character) ? section : undefined;
}
