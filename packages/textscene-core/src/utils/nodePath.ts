/**
 * Node paths as this codebase keys its maps: joining them and listing their ancestors. Godot's own
 * walk over a NodePath is an engine fact, in `godot/nodePath.ts`.
 */

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
 * The key the scene root occupies in a path-to-node map. Paths here are measured from the root,
 * so its own name is not one of their segments and it sits at the empty path.
 */
export const SCENE_ROOT_PATH = '';
