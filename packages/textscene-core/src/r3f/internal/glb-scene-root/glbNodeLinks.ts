/**
 * Where each GLB node sits under the instancing scene, and the node data its override gives it:
 * the shared reading the scene cull and the typed children attached into the GLB both start from.
 */

import type * as THREE from 'three';
import type { LiveNode } from '../../../resources/liveNode';
import { parseGeometryInstance3D } from '../../../nodes/3d/geometryinstance3d/parser';
import type { GeometryInstance3DProperties } from '../../../nodes/3d/geometryinstance3d/types';
import { visibilityParentOf } from '../../../godot/scene/visibilityParent';
import { joinPath } from '../../../utils/nodePath';
import type { NodePlace } from '../../visibilityRange/visibilityScene';
import { glbObjectName, type GlbObjectEntry } from './glbHierarchy';
import type { GlbRoot } from './GlbInstanceContext';
import { isApplicableGlbOverride, resolveGlbOverrideTarget } from './glbNodeOverrides';

/**
 * One GLB node as the instancing scene's headings leave it: where it sits, its node data and the
 * visibility parent it takes from its parent (`node_3d.cpp:1307-1318`), which it passes on to its
 * children.
 */
export interface GlbNodeLink {
  entry: GlbObjectEntry;
  properties: GeometryInstance3DProperties;
  place: Omit<NodePlace, 'order'>;
}

/**
 * Each GLB node below the root in `entries` order, as the instancing scene leaves it. A node
 * without an override of its own is at its `relPath` under the root, and takes its parent's
 * visibility parent.
 */
export function glbNodeLinks(
  object: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  root: GlbRoot,
  uniquePaths: ReadonlyMap<string, string> | undefined
): GlbNodeLink[] {
  const overrides = overridesByTarget(object, entries, root.overrides);
  const passedOn = new Map<THREE.Object3D, string | null>();
  return entries.map((entry) => {
    const override = overrides.get(entry.object);
    const path =
      root.path === null
        ? null
        : joinPath(
            root.path,
            override ? joinPath(override.instanceSubPath ?? '', override.name) : entry.relPath
          );
    const properties = parseGeometryInstance3D(
      { type: 'node', attributes: { name: glbObjectName(entry.object) } },
      override?.rawProperties ?? {}
    );
    // `has`, not `??`: a parent whose own link resolves to none passes none on.
    const parent = entry.object.parent!;
    const inherited = passedOn.has(parent) ? (passedOn.get(parent) ?? null) : root.visibilityParent;
    const parentPath =
      path === null
        ? inherited
        : visibilityParentOf(path, properties.visibility_parent, inherited, uniquePaths);
    passedOn.set(entry.object, parentPath);
    return { entry, properties, place: { path, parentPath } };
  });
}

/** Each GLB object an override node applies to, with the first override that names it. */
function overridesByTarget(
  object: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  overrides: readonly LiveNode[]
): Map<THREE.Object3D, LiveNode> {
  const byTarget = new Map<THREE.Object3D, LiveNode>();
  for (const override of overrides) {
    if (!isApplicableGlbOverride(override)) continue;
    const target = resolveGlbOverrideTarget(object, entries, override);
    if (target && !byTarget.has(target)) byTarget.set(target, override);
  }
  return byTarget;
}
