/**
 * The node paths a heading spells in `parent=`, `from=` and `to=`, and the `[node]` heading each
 * one names. Godot writes all three relative to the scene root and walks them with
 * `get_node_or_null` from there (`resource_format_text.cpp:204-211, 371-372`), so one walk
 * (`resolveParentPath`) resolves them. A path into an instanced scene names no heading here.
 */

import { resolveParentPath, type ParentPathTree } from '../godot/string/nodePath.js';
import { getAncestorPaths, joinPath, SCENE_ROOT_PATH } from '../utils/nodePath.js';
import { claimsUniqueName, claimUniqueName, UNIQUE_NAME_PROPERTY } from '../utils/uniqueNames.js';
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

/** The `[node]` headings of a file, by the root-relative path each declares. */
interface NodeTable {
  readonly byPath: ReadonlyMap<string, DocumentSection>;
  /** What `resolveParentPath` reads: the paths a descent may enter, and the `%Name` claims. */
  readonly tree: ParentPathTree;
  /** The path references that resolve to each node heading, in line order. */
  readonly usesByNode: ReadonlyMap<DocumentSection, readonly NodePathReference[]>;
}

/** Written only by {@link nodeTableOf}. An entry lives as long as its document. */
const nodeTables = new WeakMap<LanguageDocument, NodeTable>();

/** The value of a heading's `unique_name_in_owner` property, or undefined without one. */
function uniqueNameValueOf(section: DocumentSection): string | undefined {
  return section.properties.find(({ storedKey }) => storedKey === UNIQUE_NAME_PROPERTY)?.value;
}

/** The node paths a heading line spells. */
function referencesOnHeading(section: DocumentSection, lineText: string): NodePathReference[] {
  const line = section.headingLine - 1;
  return (PATH_ATTRIBUTES.get(section.tag) ?? []).flatMap((key) => {
    const attribute = headingAttribute(lineText, key);
    return attribute ? [{ path: attribute.value, range: lineRange(line, attribute.span) }] : [];
  });
}

/**
 * The first `[node]` heading with no `parent=`: the scene root, seated at the empty path before any
 * other, as `buildSceneTree` does.
 */
function sceneRootOf(document: LanguageDocument): DocumentSection | undefined {
  return document.sections.find(({ tag, attributes }) => tag === 'node' && attributes.parent === undefined);
}

/**
 * The declared nodes, with the walk tables that resolve a path over them. Each heading is seated
 * under the path its `parent=` resolves to when it is read, as `buildSceneTree` seats it
 * (`packed_scene.cpp:157-165`), so a parent spelled `%Name` or `./A` seats it at the canonical path.
 */
function declaredNodes(document: LanguageDocument): Pick<NodeTable, 'byPath' | 'tree'> {
  const byPath = new Map<string, DocumentSection>();
  const uniquePaths = new Map<string, string>();
  // A descent may enter a declared path or a proper ancestor of one, since a parent can sit in an instance.
  const enterable = new Set<string>([SCENE_ROOT_PATH]);
  const tree: ParentPathTree = { exists: (path) => enterable.has(path), uniquePaths };
  const root = sceneRootOf(document);
  if (root) byPath.set(SCENE_ROOT_PATH, root);
  for (const section of document.sections) {
    const { name, parent } = section.attributes;
    // A nameless heading claims no path, and a second parentless one is stranded.
    if (section.tag !== 'node' || !name || section === root || parent === undefined) continue;
    const parentPath = resolveParentPath(parent, tree);
    if (parentPath === null) continue;
    const path = joinPath(parentPath, name);
    if (byPath.has(path)) continue;
    byPath.set(path, section);
    enterable.add(path);
    for (const ancestor of getAncestorPaths(path)) enterable.add(ancestor);
    if (claimsUniqueName(uniqueNameValueOf(section))) claimUniqueName(uniquePaths, name, path);
  }
  return { byPath, tree };
}

function buildNodeTable(document: LanguageDocument): NodeTable {
  const { byPath, tree } = declaredNodes(document);
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
  return { byPath, tree, usesByNode };
}

function nodeTableOf(document: LanguageDocument): NodeTable {
  let table = nodeTables.get(document);
  if (!table) {
    table = buildNodeTable(document);
    nodeTables.set(document, table);
  }
  return table;
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
