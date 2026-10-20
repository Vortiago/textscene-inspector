/**
 * Node paths as this codebase keys its maps: joining them and listing their ancestors. Godot's own
 * walk over a NodePath is an engine fact, in `godot/string/nodePath.ts`.
 */

/** The path of a child named `childName` below the node at `parentPath`. */
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
 * so its own name is not one of their segments and it sits at the empty path. `resolveParentPath`
 * in `godot/string/nodePath.ts` spells the root the same way and cannot import this.
 */
export const SCENE_ROOT_PATH = '';

/** A node of a seated tree, as {@link treePathOf} walks it. */
interface TreeNode {
  readonly name: string;
  readonly children: readonly TreeNode[];
  /** The path below the instance that holds the node, when its `parent=` descends into instanced content. */
  readonly instanceSubPath?: string;
}

/**
 * The path `target` is seated at below `root`, joined as the tree builder keys it, or undefined
 * where it hangs elsewhere. The root itself is at {@link SCENE_ROOT_PATH}.
 */
export function treePathOf(root: TreeNode, target: TreeNode): string | undefined {
  return pathBelow(root, SCENE_ROOT_PATH, target);
}

/** {@link treePathOf} from a node already known to sit at `path`. */
function pathBelow(node: TreeNode, path: string, target: TreeNode): string | undefined {
  if (node === target) return path;
  for (const child of node.children) {
    const parentPath = child.instanceSubPath ? joinPath(path, child.instanceSubPath) : path;
    const found = pathBelow(child, joinPath(parentPath, child.name), target);
    if (found !== undefined) return found;
  }
  return undefined;
}
