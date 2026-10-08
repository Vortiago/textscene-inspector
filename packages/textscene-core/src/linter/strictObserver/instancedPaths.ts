/**
 * The node paths that instance a scene, so a type-less heading below one names content that exists. Keys are folded
 * paths (`./Rock` and `Rock` are one node), and the root joins as `SCENE_ROOT_PATH` when heading 0 carries `instance=`
 * (resource_format_text.cpp:233-240). Not `instance_placeholder=`: an InstancePlaceholder has no children
 * (packed_scene.cpp:255), so a node named under one still vanishes.
 */

import type { ParsedHeading } from '../../parser/utils.js';
import { SCENE_ROOT_PATH, getAncestorPaths, joinPath } from '../../utils/nodePath.js';
import { resolveParentPath } from '../../godot/nodePath.js';

export interface InstancedPaths {
  /** Records a `[node]` heading, in scan order. */
  record(heading: ParsedHeading, isRoot: boolean): void;
  /** Whether a heading under `parent=` sits inside content an earlier heading instanced. */
  hasInstancedAncestor(parent: string | undefined): boolean;
}

export function instancedPaths(): InstancedPaths {
  const paths = new Set<string>();
  return {
    record(heading, isRoot) {
      const { instance, parent, name } = heading.attributes;
      if (!instance) return;
      // An empty `parent=` reads as the root here. That is no engine claim: it faults the load itself
      // (resource_format_text.cpp:206-207), which `empty-parent-path` reports, and it keeps every other heading
      // checkable. The root heading is the scene root whatever its name, and a heading with no `name=` vouches for none.
      if (isRoot) {
        paths.add(SCENE_ROOT_PATH);
      } else if (name) {
        // Null where the path resolves against nothing (an absolute path, or `..` above the root): the fallback
        // re-roots the heading under a path no other heading can spell, so it vouches for none.
        const parentPath = parent ? resolveParentPath(parent) : SCENE_ROOT_PATH;
        if (parentPath !== null) paths.add(joinPath(parentPath, name));
      }
    },
    hasInstancedAncestor(parent) {
      if (paths.has(SCENE_ROOT_PATH)) return true;
      // The root is covered above. An absolute or empty path names nothing to walk up from.
      const path = resolveParentPath(parent);
      if (!path) return false;
      return paths.has(path) || getAncestorPaths(path).some((p) => paths.has(p));
    },
  };
}
