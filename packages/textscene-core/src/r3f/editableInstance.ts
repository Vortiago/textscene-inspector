import type { TscnNode } from '../parser/types.js';
import { pathBetween } from '../utils/nodePath.js';
import type { LiveTreeContext } from './liveSceneTree.js';
import { localSceneOf, type ClaimOwner } from './uniqueNameOwner.js';

/** `Node::is_editable_instance` of the node at `path`: only an instance node carries the flag. */
export function isEditableInstanceAt(
  path: string,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  rootEditablePaths: readonly string[]
): boolean {
  const instance = localSceneOf(path, roots, ctx);
  return instance.path === path && isEditableInstance(instance, rootEditablePaths);
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
