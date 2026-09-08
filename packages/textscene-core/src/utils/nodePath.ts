/** Utilities for manipulating node paths in the scene tree. */

import { nodePathWalkNames } from '../godot/nodePath.js';
import { nodePathLiteral } from '../godot/variantParser.js';
import { UNIQUE_NODE_PREFIX } from './uniqueNames.js';

export function joinPath(parentPath: string, childName: string): string {
  return parentPath ? `${parentPath}/${childName}` : childName;
}

export function getAncestorPaths(nodePath: string): string[] {
  const parts = nodePath.split('/');
  const ancestors: string[] = [];

  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'));
  }

  return ancestors;
}

/**
 * Walk `relative` from the node whose path is `base`, the way
 * `Node::get_node_or_null` walks a NodePath (node.cpp:1912-1949).
 *
 * The walk runs over the names the constructor kept
 * ({@link nodePathWalkNames}), so a leading, doubled or trailing slash
 * contributes nothing and a `:subname` addresses a property rather than a node.
 * `.` stays on the node the walk is on and `..` steps to its parent.
 *
 * `rootDepth` is how many leading segments spell the scene root, and therefore
 * the length at which `..` has nowhere left to go: `!current->data.parent`
 * returns nullptr (node.cpp:1919-1922), which is null here.
 *
 * `exists` is the child lookup: a name that is not a child returns nullptr on
 * the spot (node.cpp:1941-1946), which is what makes this a WALK rather than a
 * fold — `Missing/../Real` stops at `Missing` however well `Real` resolves.
 * A caller with no tree to ask omits it and gets the folded answer, which is
 * the wider one.
 *
 * A `%Name` segment is a JUMP, not a descent: the name is looked up in the
 * owner's claim table and the walk continues from whatever node it finds
 * (node.cpp:1930-1938), so it restarts at the claimed path and a following `..`
 * steps up from THERE. Without a table there is nothing to look it up in, and
 * null is the honest answer.
 */
function walkNodePath(
  base: readonly string[],
  relative: string,
  rootDepth: number,
  uniquePaths?: ReadonlyMap<string, string>,
  exists?: (path: string) => boolean
): string[] | null {
  let segments = [...base];
  for (const part of nodePathWalkNames(relative)) {
    if (part === '.') continue;
    if (part === '..') {
      if (segments.length <= rootDepth) return null;
      segments.pop();
      continue;
    }
    if (part.startsWith(UNIQUE_NODE_PREFIX)) {
      const claimed = uniquePaths?.get(part);
      if (!claimed) return null;
      segments = claimed.split('/');
      continue;
    }
    segments.push(part);
    // Only a descent needs asking: `.` moves nowhere and `..` returns to a path
    // the walk already stood on.
    if (exists && !exists(segments.join('/'))) return null;
  }
  return segments;
}

/**
 * Resolve a relative node path against a base node's own path, Godot-style: `..` steps up
 * one level, `.` and empty segments are skipped, anything else descends.
 *
 * The base is the node ITSELF, not its parent, so `"Child"` addresses a child and
 * `"../Sibling"` addresses a sibling. Returns null if the path walks above the root.
 *
 * Paths here carry the scene root as their FIRST segment, which is what makes
 * that segment the floor.
 */
export function resolveRelativePath(
  basePath: string,
  relative: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  return walkNodePath(basePath.split('/'), relative, 1, uniquePaths)?.join('/') ?? null;
}

/**
 * The key the scene root occupies in a path-to-node map. Paths here are
 * measured FROM the root, so its own name is not one of their segments and it
 * sits at the empty path.
 */
export const SCENE_ROOT_PATH = '';

/**
 * The node a `[node]` heading's `parent=` names, spelled the way the scene tree
 * keys it — {@link SCENE_ROOT_PATH} for the scene root itself — or null when it
 * addresses no node in this file.
 *
 * A `.tscn` always stores the value as a path rather than an index
 * (`resource_format_text.cpp:212`), and instantiate resolves it with
 * `ret_nodes[0]->get_node_or_null(np)` (`packed_scene.cpp:161`) — from the
 * root, so the root is the floor and paths here omit its name.
 *
 * `tree` is what a caller holding the scene knows: whether a path names a node
 * yet, and which node claims each `%Name`. A caller with neither gets the
 * folded answer, which is the wider one — it resolves `Missing/../Real`, which
 * `get_node_or_null` refuses at `Missing`.
 *
 * Five shapes address nothing and are null rather than a path: an absent or
 * empty value, since `NodePath("")` is empty and `get_node_or_null` returns
 * nullptr for it (node.cpp:1894); an absolute `/root/…`, which instantiate
 * refuses off-tree (node.cpp:1898); a `..` that steps above the root, where
 * `!current->data.parent` returns nullptr (node.cpp:1919-1922); a name the tree
 * does not know (node.cpp:1941-1946); and a `%Name` no node claims, which the
 * owner's table has no entry for (node.cpp:1930-1938). Godot's own serialiser
 * writes `parent_path.simplified()` and never emits that last shape
 * (resource_format_text.cpp:2018), but the loader resolves one: probed on
 * 4.7.2, `parent="%Player"` seats the node under the claiming `Player` and
 * warns the path vanished only when nothing claims it.
 */
export interface ParentPathTree {
  /** Whether a path names a node yet — the child lookup at each descent. */
  readonly exists: (path: string) => boolean;
  /** `%Name` to the path of the node claiming it, in the scene root's table. */
  readonly uniquePaths: ReadonlyMap<string, string>;
}

export function resolveParentPath(
  parentPath: string | undefined,
  tree?: ParentPathTree
): string | null {
  if (!parentPath || parentPath.startsWith('/')) return null;
  return walkNodePath([], parentPath, 0, tree?.uniquePaths, tree?.exists)?.join('/') ?? null;
}

/**
 * Resolve a raw TSCN `NodePath("…")` literal, written on the node at `basePath`, to an
 * absolute path in the parsed tree. Returns null when it does not address another node.
 *
 * Shared by every scene-wide pass that follows a NodePath: RemoteTransform3D/2D's
 * `remote_path` and CSGPolygon3D's `path_node`. One definition, because two copies of
 * relative-path arithmetic would drift and the difference would only surface on a scene
 * that actually used `..`.
 *
 * `uniquePaths` maps `%Name` to the path claiming it — build it with `uniqueNameClaims`
 * over the same tree the caller resolves against. Without it a `%Name` resolves to null
 * rather than to a path no node can occupy: `%` is an invalid node-name character
 * (ustring.cpp:5071), so treating the segment as an ordinary child produced a lookup
 * that could never hit.
 */
export function resolveNodePathLiteral(
  basePath: string,
  raw: string | undefined,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  const inner = relativePathText(raw);
  return inner === null ? null : resolveRelativePath(basePath, inner, uniquePaths);
}

/**
 * A literal's path text, or null when it addresses no node in this file BY
 * CONSTRUCTION rather than by failing: an absent value, `.`, and an absolute
 * `/root/…` path, which measures from the live SceneTree a static parse does not
 * model.
 */
function relativePathText(raw: string | undefined): string | null {
  if (!raw) return null;
  // Whole property values arrive here; text that is neither spelling is taken
  // as the path itself.
  const inner = (nodePathLiteral(raw) ?? raw).trim();
  if (inner === '' || inner === '.') return null;
  if (inner.startsWith('/')) return null;
  return inner;
}

/**
 * The `%Name` segments this literal names that nothing claims — the reason a
 * resolve returned null on a path the file plainly meant to address a node with.
 *
 * Callers that report a dangling path need this to tell the two nulls apart: the
 * paths above address nothing deliberately and are never reported here.
 */
export function unclaimedUniqueNames(
  raw: string | undefined,
  uniquePaths?: ReadonlyMap<string, string>
): string[] {
  const inner = relativePathText(raw);
  if (inner === null) return [];
  return nodePathWalkNames(inner).filter(
    (segment) => segment.startsWith(UNIQUE_NODE_PREFIX) && !uniquePaths?.has(segment)
  );
}
