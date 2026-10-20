/**
 * The node paths a heading spells in `parent=`, `from=` and `to=`, and the `[node]` heading each
 * one names. The loader stores a `parent=` as written (`resource_format_text.cpp:205-212`) and a
 * connection end simplified (`:370-371`). Instantiate walks each from the scene root with
 * `get_node_or_null` (`packed_scene.cpp:157-165`). A path into an instanced scene names no heading.
 */

import { resolveParentPath, simplifiedNodePath, type ParentPathTree } from '../godot/string/nodePath.js';
import { createRawNode } from '../parser/rawNode.js';
import { seatSceneTree } from '../parser/sceneTreeBuilder.js';
import type { RawNode } from '../parser/types.js';
import type { DocumentSection, LanguageDocument } from './document.js';
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

/** The `[node]` headings of a file, seated as Godot seats them. */
interface NodeTable {
  /** Each seated heading by its root-relative path, the root at the empty path. */
  readonly byPath: ReadonlyMap<string, DocumentSection>;
  /** The root-relative path of each seated heading with a name. */
  readonly pathOf: ReadonlyMap<DocumentSection, string>;
  /** What `resolveParentPath` reads: the child lookup at each descent, and the `%Name` claims. */
  readonly tree: ParentPathTree;
  /** The path references that resolve to each node heading, in line order. */
  readonly usesByNode: ReadonlyMap<DocumentSection, readonly NodePathReference[]>;
}

/** Written only by {@link nodeTableOf}. An entry lives as long as its document. */
const nodeTables = new WeakMap<LanguageDocument, NodeTable>();

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

/** A section's properties as the parser keys a node's raw properties: by the key the engine stores. */
function rawPropertiesOf(section: DocumentSection): Record<string, string> {
  return Object.fromEntries(section.properties.map(({ storedKey, value }) => [storedKey, value]));
}

/** The table of a file with no `[node]` heading, where no path names a node. */
const NO_NODES: Pick<NodeTable, 'byPath' | 'pathOf' | 'tree'> = {
  byPath: new Map(),
  pathOf: new Map(),
  tree: { exists: () => false, uniquePaths: new Map() },
};

/** The node headings seated by the tree builder the parser and linter use, mapped back to their sections. */
function seatedNodes(document: LanguageDocument): Pick<NodeTable, 'byPath' | 'pathOf' | 'tree'> {
  const sectionOf = new Map<RawNode, DocumentSection>();
  const nodes = document.sections
    .filter(({ tag }) => tag === 'node')
    .map((section) => {
      const node = createRawNode(
        { type: section.tag, attributes: { ...section.attributes } },
        rawPropertiesOf(section)
      );
      sectionOf.set(node, section);
      return node;
    });
  const seating = seatSceneTree(nodes);
  if (!seating) return NO_NODES;
  const byPath = new Map([...seating.byPath].map(([path, node]) => [path, sectionOf.get(node)!]));
  const pathOf = new Map([...seating.pathOf].map(([node, path]) => [sectionOf.get(node)!, path]));
  return { byPath, pathOf, tree: seating.tree };
}

function buildNodeTable(document: LanguageDocument): NodeTable {
  const { byPath, pathOf, tree } = seatedNodes(document);
  const usesByNode = new Map<DocumentSection, NodePathReference[]>();
  for (const section of document.sections) {
    for (const reference of referencesOnHeading(section, document.lines[section.headingLine - 1] ?? '')) {
      const resolved = resolveParentPath(reference.path, tree);
      const node = resolved === null ? undefined : byPath.get(resolved);
      if (!node) continue;
      const uses = usesByNode.get(node) ?? [];
      uses.push(reference);
      usesByNode.set(node, uses);
    }
  }
  return { byPath, pathOf, tree, usesByNode };
}

function nodeTableOf(document: LanguageDocument): NodeTable {
  let table = nodeTables.get(document);
  if (!table) {
    table = buildNodeTable(document);
    nodeTables.set(document, table);
  }
  return table;
}

/** The root-relative path of each seated `[node]` heading with a name, the root at the empty path. */
export function seatedNodePaths(document: LanguageDocument): ReadonlyMap<DocumentSection, string> {
  return nodeTableOf(document).pathOf;
}

/** The `[node]` heading a written node path names, or undefined for a path this file never declares. */
export function nodeSectionOfPath(document: LanguageDocument, path: string): DocumentSection | undefined {
  const table = nodeTableOf(document);
  const resolved = resolveParentPath(path, table.tree);
  return resolved === null ? undefined : table.byPath.get(resolved);
}

/** Every `parent=`, `from=` and `to=` value that resolves to `node`, in line order. */
export function nodeUses(document: LanguageDocument, node: DocumentSection): readonly NodePathReference[] {
  return nodeTableOf(document).usesByNode.get(node) ?? [];
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
