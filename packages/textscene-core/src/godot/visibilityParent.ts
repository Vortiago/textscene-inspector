/**
 * The visibility parent of a node, as `Node3D::_update_visibility_parent` settles it
 * (`node_3d.cpp:1304-1335`): its own `visibility_parent`, or else its Node3D parent's.
 */

import { resolveRelativePath } from './nodePath.js';

/**
 * The node path of the visibility parent of the node at `path`, or null for none. `own` is its
 * authored `visibility_parent`, which Godot refuses when it names the node itself (`:1313`). A
 * path that names no GeometryInstance3D the scene cull holds, the cull treats as none.
 */
export function visibilityParentOf(
  path: string,
  own: string | undefined,
  inherited: string | null,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  if (own === undefined) return inherited;
  const resolved = resolveRelativePath(path, own, uniquePaths);
  return resolved === path ? null : resolved;
}
