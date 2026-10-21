/**
 * Node paths as this codebase keys its maps: joining them and listing their ancestors. Godot's own
 * walk over a NodePath is an engine fact, in `godot/string/nodePath.ts`.
 */

/** The path of a child named `childName` below the node at `parentPath`. */
export function joinPath(parentPath: string, childName: string): string {
  return parentPath ? `${parentPath}/${childName}` : childName;
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

/**
 * A root-relative path as a NodePath spells it, which has no empty path: the root is `.`
 * (`node_path.cpp:301-302`). Godot's "Copy Node Path" writes this (`scene_tree_dock.cpp:1249-1258`).
 */
export function spelledNodePath(rootRelativePath: string): string {
  return rootRelativePath === SCENE_ROOT_PATH ? '.' : rootRelativePath;
}

/** {@link spelledNodePath} for a live path, whose first segment is the root's name. */
export function spelledLiveNodePath(livePath: string): string {
  return spelledNodePath(
    livePath.includes('/') ? livePath.slice(livePath.indexOf('/') + 1) : SCENE_ROOT_PATH
  );
}
