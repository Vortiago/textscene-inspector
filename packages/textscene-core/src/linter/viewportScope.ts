/**
 * Which current-camera slot a node contends. The slot is per viewport, so a rule
 * about competing cameras must compare scopes, never the whole scene.
 */

import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { searchAncestors, type SceneRoots } from './parentType.js';
import { perTree } from '../utils/perTree.js';
import type { RawNode, RawScene } from '../parser/types.js';

/**
 * The nearest Viewport ancestor (`node.cpp:345-347`), or null for the scene's own
 * viewport. `undefined` for an ancestor whose class this file does not declare: it
 * may be an instanced Viewport, and pooling its cameras into the outer scope is
 * the false positive this scoping prevents.
 */
export function viewportScopeOf(scene: SceneRoots, node: RawNode): RawNode | null | undefined {
  // The slot is `get_viewport()`'s, for 2D (camera_2d.cpp:342) and 3D (camera_3d.cpp:186)
  // alike: the 2D group is `"__cameras_" + itos(vp.get_id())` (camera_2d.cpp:349) and
  // `make_current` gates on `!viewport->get_camera_2d()` (:354, viewport.h:764).
  // `Window` is a Viewport (window.h:43), so the base chain scopes a dialog too.
  const search = searchAncestors(scene, node, (ancestor) =>
    // `visit` gets only ancestors whose type this file states and the catalog knows.
    descendsFromClass(ancestor.type, 'Viewport') ? ancestor : undefined
  );
  if (search.kind === 'unknowable') return undefined;
  return search.kind === 'found' ? search.value : null;
}

/**
 * A counter of the claiming nodes that share one viewport scope, tallied once per tree.
 * A walk per node is O(matches x nodes x depth) on the very scene a contention rule
 * detects. `claimants` returns the nodes that claim the slot.
 */
export function viewportScopeCounter(
  claimants: (roots: readonly RawNode[]) => Iterable<RawNode>
): (scene: RawScene, scope: RawNode | null) => number {
  const tallyOf = perTree((roots) => tallyScopes(roots, claimants(roots)));
  return (scene, scope) => tallyOf(scene.nodes).get(scope) ?? 0;
}

function tallyScopes(roots: readonly RawNode[], claimants: Iterable<RawNode>): Map<RawNode | null, number> {
  const tally = new Map<RawNode | null, number>();
  for (const claimant of claimants) {
    // A node whose viewport this file cannot determine is left out of the
    // contending set: `undefined` is never a scope a caller holds.
    const claimantScope = viewportScopeOf({ nodes: roots }, claimant);
    if (claimantScope === undefined) continue;
    tally.set(claimantScope, (tally.get(claimantScope) ?? 0) + 1);
  }
  return tally;
}
