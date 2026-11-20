import type { TscnNode } from '../parser/types.js';
import { pathBetween } from '../utils/nodePath.js';
import type { LiveTreeContext } from './liveSceneTree.js';
import { claimOwnerOf, type ClaimOwner } from './uniqueNameOwner.js';

/** Whether Godot's Scene dock lists the node at live `path` (`scene_tree_editor.cpp:283-290`). */
export function dockLists(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  rootEditablePaths: readonly string[]
): boolean {
  const segments = path.split('/');
  // The dock stops at an unlisted node, so each node on the way down is listed too.
  for (let depth = 2; depth <= segments.length; depth++) {
    const owner = claimOwnerOf(segments.slice(0, depth).join('/'), roots, ctx);
    if (!isListedOwner(owner, rootEditablePaths)) return false;
  }
  return true;
}

function isListedOwner(owner: ClaimOwner, rootEditablePaths: readonly string[]): boolean {
  if (!owner.parent) return owner.roots.length > 0;
  // The root of an inherited scene is the edited root, which owns what it inherits.
  if (!owner.parent.parent && owner.path === owner.parent.path) return true;
  return isEditableInstance(owner, rootEditablePaths);
}

/** Godot sets the flag from any enclosing file that lists the instance (`packed_scene.cpp:691-695`). */
function isEditableInstance(instance: ClaimOwner, rootEditablePaths: readonly string[]): boolean {
  for (let file = instance.parent; file; file = file.parent) {
    if (editablePathsOf(file, rootEditablePaths).includes(pathBetween(file.path, instance.path))) return true;
  }
  return false;
}

function editablePathsOf(file: ClaimOwner, rootEditablePaths: readonly string[]): readonly string[] {
  if (!file.parent) return rootEditablePaths;
  const scenePath = file.live.tree.at(file.path)?.step.instancePath;
  return scenePath ? file.live.tree.sceneEditablePaths(scenePath) : [];
}
