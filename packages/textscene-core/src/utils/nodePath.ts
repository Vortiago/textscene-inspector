/** Node paths in the scene tree: joining them, and resolving a NodePath as Godot walks one. */

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
 * Walks `relative` from the node at `base` as `Node::get_node_or_null` walks a NodePath
 * (node.cpp:1912-1949), over the names the constructor kept ({@link nodePathWalkNames}): an extra
 * slash adds nothing and a `:subname` addresses a property. `rootDepth` counts the segments that
 * spell the scene root. Without `exists`, the answer is the wider folded one.
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
      // Nothing above the root: `!current->data.parent` returns nullptr (node.cpp:1919-1922).
      if (segments.length <= rootDepth) return null;
      segments.pop();
      continue;
    }
    if (part.startsWith(UNIQUE_NODE_PREFIX)) {
      // A jump through the owner's claim table (node.cpp:1930-1938): the walk restarts at the
      // claimed path, so a following `..` steps up from there. Without a table it is null.
      const claimed = uniquePaths?.get(part);
      if (!claimed) return null;
      segments = claimed.split('/');
      continue;
    }
    segments.push(part);
    // A missing child returns nullptr at once (node.cpp:1941-1946), so `Missing/../Real` stops at
    // `Missing`. Only a descent asks: `.` moves nowhere and `..` returns to a visited path.
    if (exists && !exists(segments.join('/'))) return null;
  }
  return segments;
}

/**
 * A relative node path resolved against the base node itself, not its parent, so `"Child"` is a
 * child and `"../Sibling"` a sibling. The base path's first segment is the scene root, the floor:
 * null when the path walks above it. An absolute path measures from the SceneTree root
 * (node.cpp:1903-1909), which a preview has no counterpart for, so it reaches nothing.
 */
export function resolveRelativePath(
  basePath: string,
  relative: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  if (relative.startsWith('/')) return null;
  return walkNodePath(basePath.split('/'), relative, 1, uniquePaths)?.join('/') ?? null;
}

/**
 * The key the scene root occupies in a path-to-node map. Paths here are measured from the root,
 * so its own name is not one of their segments and it sits at the empty path.
 */
export const SCENE_ROOT_PATH = '';

/**
 * What a caller holding the scene knows for `resolveParentPath`. Without it, the answer is the
 * wider folded one: it resolves `Missing/../Real`, which `get_node_or_null` refuses at `Missing`.
 */
export interface ParentPathTree {
  /** Whether a path names a node yet: the child lookup at each descent. */
  readonly exists: (path: string) => boolean;
  /** `%Name` to the path of the node claiming it, in the scene root's table. */
  readonly uniquePaths: ReadonlyMap<string, string>;
}

/**
 * The node a `[node]` heading's `parent=` names, keyed as the scene tree keys it
 * ({@link SCENE_ROOT_PATH} for the root), or null when it addresses no node in this file. A `.tscn`
 * stores a path (`resource_format_text.cpp:212`) that instantiate resolves from the root with
 * `get_node_or_null` (`packed_scene.cpp:161`), so the root is the floor and paths omit its name.
 */
export function resolveParentPath(
  parentPath: string | undefined,
  tree?: ParentPathTree
): string | null {
  // An empty `NodePath("")` returns nullptr (node.cpp:1894), and instantiate refuses an absolute
  // `/root/…` off-tree (node.cpp:1898). The walk adds the rest. The saver never writes a `%Name`
  // (resource_format_text.cpp:2018), yet on 4.7.2 the loader seats `parent="%Player"` under its
  // claimant and warns only when nothing claims it.
  if (!parentPath || parentPath.startsWith('/')) return null;
  return walkNodePath([], parentPath, 0, tree?.uniquePaths, tree?.exists)?.join('/') ?? null;
}

/**
 * A raw `NodePath("…")` literal on the node at `basePath` as an absolute path in the parsed tree,
 * or null when it addresses no other node. Every scene-wide pass that follows a NodePath shares
 * it: RemoteTransform3D/2D's `remote_path` and CSGPolygon3D's `path_node`.
 *
 * @param uniquePaths `%Name` to its claiming path, from `uniqueNameClaims` over the same tree.
 *   Without it a `%Name` is null: `%` is invalid in a node name (ustring.cpp:5071), so a child
 *   lookup for it never hits.
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
 * A literal's path text, or null when it addresses no node in this file by construction: an
 * absent value, `.`, or an absolute `/root/…` path, which measures from the live SceneTree.
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
 * The `%Name` segments of this literal that nothing claims, so a caller reporting a dangling path
 * tells that null apart from the deliberate nulls above, which never report here.
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
