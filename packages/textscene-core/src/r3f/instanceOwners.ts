/**
 * Who owns a node of the live tree, in Godot's sense: the root of the scene file that authored it.
 * Paths here are root-relative, as `belowRoot` gives them.
 */

import { SCENE_ROOT_PATH, relativeTo } from '../utils/nodePath';

/** One scene file on the way down to a node: the edited root, or an instance of a sub-scene. */
export interface InstanceOwner {
  /** How many scenes enclose the nodes this file authored. Zero for the edited root. */
  readonly level: number;
  /** The root-relative path of the instance node. The edited root's is {@link SCENE_ROOT_PATH}. */
  readonly path: string;
  /** The `[editable]` paths this file lists, each relative to this file's own root. */
  readonly editablePaths: readonly string[];
  /** Whether the edited root's editor may edit the nodes this file authored. */
  readonly isEditable: boolean;
}

/** The edited root with no `[editable]` heading. It owns the nodes of its own file. */
export const ROOT_OWNER: InstanceOwner = {
  level: 0,
  path: SCENE_ROOT_PATH,
  editablePaths: [],
  isEditable: true,
};

/**
 * The owner an instance at `path` becomes, with `editablePaths` its own file lists. Godot sets the
 * node's flag from any enclosing file that lists it (`packed_scene.cpp:691-695`), each path relative
 * to that file's root. `enclosing` holds the owners above the instance, outermost first.
 */
export function instanceOwner(
  enclosing: readonly InstanceOwner[],
  level: number,
  path: string,
  editablePaths: readonly string[]
): InstanceOwner {
  const isEditable = enclosing.some((owner) => {
    const relative = owner.path === SCENE_ROOT_PATH ? path : relativeTo(owner.path, path);
    return relative !== undefined && owner.editablePaths.includes(relative);
  });
  return { level, path, editablePaths, isEditable };
}

function innermostOwnerOfLevel(owners: readonly InstanceOwner[], level: number): InstanceOwner | undefined {
  for (let i = owners.length - 1; i >= 0; i--) {
    if (owners[i]!.level === level) return owners[i];
  }
  return undefined;
}

/**
 * Whether the edited root owns the node at `path`, or lists its owner as editable. `level` counts the
 * scenes that enclose the node's content. An instance's own root sits in its content's level, yet the
 * file that instanced it owns it. A level with no known owner reads as editable.
 */
export function isEditableNode(owners: readonly InstanceOwner[], level: number, path: string): boolean {
  const own = innermostOwnerOfLevel(owners, level);
  const ownerLevel = own?.path === path ? level - 1 : level;
  return innermostOwnerOfLevel(owners, ownerLevel)?.isEditable ?? true;
}
