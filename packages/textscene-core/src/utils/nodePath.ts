/**
 * Node paths as this codebase keys its maps: joining them and listing their ancestors. Godot's own
 * walk over a NodePath is an engine fact, in `godot/string/nodePath.ts`.
 */

/**
 * The path of a child named `childName` below the node at `parentPath`.
 *
 * @canonical A node path from its parent and a name
 */
export function joinPath(parentPath: string, childName: string): string {
  return parentPath ? `${parentPath}/${childName}` : childName;
}

/**
 * The path of the node that holds the one at `path`, or null where `path` names a single segment.
 *
 * @canonical The parent of a node path
 */
export function parentPathOf(path: string): string | null {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? null : path.slice(0, cut);
}

/**
 * A root-relative path placed below the node at `parentPath`. The root, at {@link SCENE_ROOT_PATH},
 * lands on `parentPath` itself.
 */
export function pathUnder(parentPath: string, rootRelativePath: string): string {
  return rootRelativePath === SCENE_ROOT_PATH ? parentPath : joinPath(parentPath, rootRelativePath);
}

/** The path from the node at `from` to the node at `to`, climbing with `..` where `to` is not below. */
export function pathBetween(from: string, to: string): string {
  const fromSegments = from.split('/');
  const toSegments = to.split('/');
  let shared = 0;
  while (shared < fromSegments.length && fromSegments[shared] === toSegments[shared]) shared++;
  const climbs = Array<string>(fromSegments.length - shared).fill('..');
  return [...climbs, ...toSegments.slice(shared)].join('/');
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
 * The key the scene root occupies in a path-to-node map. Paths here are measured from the root,
 * so its own name is not one of their segments and it sits at the empty path. `walkFromRoot`
 * in `godot/string/nodePath.ts` spells the root the same way and cannot import this.
 */
export const SCENE_ROOT_PATH = '';

/** A live path below the root: its first segment is the root's name, and the root itself is {@link SCENE_ROOT_PATH}. */
export function belowRoot(livePath: string): string {
  const cut = livePath.indexOf('/');
  return cut === -1 ? SCENE_ROOT_PATH : livePath.slice(cut + 1);
}

/**
 * A root-relative path as a NodePath spells it, which has no empty path: the root is `.`
 * (`node_path.cpp:300-302`, `node.cpp:2332-2334`). Godot's "Copy Node Path" writes this
 * (`scene_tree_dock.cpp:1257`).
 */
export function spelledNodePath(rootRelativePath: string): string {
  return rootRelativePath === SCENE_ROOT_PATH ? '.' : rootRelativePath;
}

/** {@link spelledNodePath} for a live path. */
export function spelledLiveNodePath(livePath: string): string {
  return spelledNodePath(belowRoot(livePath));
}

/** `path` below `base`, `''` for `base` itself, or undefined where `path` is not at or below it. */
export function relativeTo(base: string, path: string): string | undefined {
  if (path === base) return '';
  return path.startsWith(base + '/') ? path.slice(base.length + 1) : undefined;
}
