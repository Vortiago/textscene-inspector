/**
 * The node paths a heading spells in `parent=`, `from=` and `to=`, and the `[node]` heading each
 * one names. Godot writes all three relative to the scene root and walks them with
 * `get_node_or_null` from there (`resource_format_text.cpp:204-211, 371-372`), so one walk
 * (`resolveParentPath`) resolves them. A path into an instanced scene names no heading here.
 */

import { resolveParentPath, UNIQUE_NODE_PREFIX, type ParentPathTree } from '../godot/string/nodePath.js';
import { boolSlotValue } from '../godot/variant/variantBool.js';
import { SCENE_ROOT_PATH } from '../utils/nodePath.js';
import type { DocumentSection, LanguageDocument } from './document.js';
import { nodePathOf, ROOT_PATH } from './nodePath.js';
import { headingAttribute, lineRange, spanContains } from './ranges.js';
import type { Position, Range } from './types.js';

/** The attributes of each heading tag that hold a node path. */
const PATH_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  node: ['parent'],
  connection: ['from', 'to'],
};

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
}

/** Written only by {@link nodeTableOf}. An entry lives as long as its document. */
const nodeTables = new WeakMap<LanguageDocument, NodeTable>();

/** The path a node heading declares, with the root at the empty path, or undefined without a name. */
function declaredPathOf(section: DocumentSection): string | undefined {
  const path = nodePathOf(section);
  return path === ROOT_PATH ? SCENE_ROOT_PATH : path;
}

/** `unique_name_in_owner = true` on a heading's body. */
function claimsUniqueName(section: DocumentSection): boolean {
  return section.properties.some(
    ({ storedKey, value }) => storedKey === 'unique_name_in_owner' && boolSlotValue(value) === true
  );
}

/** Every proper ancestor path of `path`, so a descent through an undeclared parent still enters it. */
function ancestorsOf(path: string): string[] {
  const names = path.split('/');
  return names.slice(0, -1).map((_, index) => names.slice(0, index + 1).join('/'));
}

function buildNodeTable(document: LanguageDocument): NodeTable {
  const byPath = new Map<string, DocumentSection>();
  const uniquePaths = new Map<string, string>();
  const enterable = new Set<string>();
  for (const section of document.sections) {
    const path = section.tag === 'node' ? declaredPathOf(section) : undefined;
    if (path === undefined || byPath.has(path)) continue;
    byPath.set(path, section);
    enterable.add(path);
    for (const ancestor of ancestorsOf(path)) enterable.add(ancestor);
    // The first claimant wins, and the root owns the table instead of claiming in it.
    const key = UNIQUE_NODE_PREFIX + section.attributes.name;
    if (path !== SCENE_ROOT_PATH && claimsUniqueName(section) && !uniquePaths.has(key)) {
      uniquePaths.set(key, path);
    }
  }
  return { byPath, tree: { exists: (path) => enterable.has(path), uniquePaths } };
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

/** The node paths a heading line spells. */
function referencesOnHeading(section: DocumentSection, lineText: string): NodePathReference[] {
  const line = section.headingLine - 1;
  return (PATH_ATTRIBUTES[section.tag] ?? []).flatMap((key) => {
    const attribute = headingAttribute(lineText, key);
    return attribute ? [{ path: attribute.value, range: lineRange(line, attribute.span) }] : [];
  });
}

/** Every node path in the file, in line order. */
export function nodePathReferences(document: LanguageDocument): readonly NodePathReference[] {
  return document.sections.flatMap((section) =>
    referencesOnHeading(section, document.lines[section.headingLine - 1] ?? '')
  );
}

/** The node path whose value the cursor is on, or undefined. */
export function nodePathReferenceAt(
  document: LanguageDocument,
  position: Position
): NodePathReference | undefined {
  const section = document.sectionAt(position.line + 1);
  if (section?.headingLine !== position.line + 1) return undefined;
  return referencesOnHeading(section, document.lines[position.line] ?? '').find(({ range }) =>
    spanContains({ start: range.start.character, end: range.end.character }, position.character)
  );
}

/** The `name=` value of a node heading, or undefined. */
export function nodeNameRange(document: LanguageDocument, section: DocumentSection): Range | undefined {
  const line = section.headingLine - 1;
  const attribute = headingAttribute(document.lines[line] ?? '', 'name');
  return attribute && lineRange(line, attribute.span);
}
