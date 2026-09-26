/**
 * Which current-camera slot a node contends. The slot is per viewport, so a rule
 * about competing cameras must compare scopes, never the whole scene.
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { searchAncestors } from './parentType.js';

/**
 * The nearest Viewport ancestor (`node.cpp:345-347`), or null for the scene's own
 * viewport. `undefined` for an ancestor whose class this file does not declare: it
 * may be an instanced Viewport, and pooling its cameras into the outer scope is
 * the false positive this scoping prevents.
 */
export function viewportScopeOf(
  scene: TscnScene,
  node: TscnNode
): TscnNode | null | undefined {
  // The slot is `get_viewport()`'s, for 2D (camera_2d.cpp:342) and 3D (camera_3d.cpp:186)
  // alike: the 2D group is `"__cameras_" + itos(vp.get_id())` (camera_2d.cpp:349) and
  // `make_current` gates on `!viewport->get_camera_2d()` (:354, viewport.h:764).
  // `Window` is a Viewport (window.h:43), so the base chain scopes a dialog too.
  const search = searchAncestors(scene, node, (ancestor) =>
    // `visit` gets only ancestors whose type this file states and the catalog knows.
    descendsFrom(ancestor.type, 'Viewport') ? ancestor : undefined
  );
  if (search.kind === 'unknowable') return undefined;
  return search.kind === 'found' ? search.value : null;
}

/**
 * A counter of the claiming nodes that share one viewport scope, tallied once per scene.
 * A walk per node is O(matches x nodes x depth) on the very scene a contention rule
 * detects. Keyed on the roots array, since `viewportScopeOf` reads nothing of `scene`
 * but `nodes`. `claimants` returns the nodes that claim the slot.
 */
export function viewportScopeCounter(
  claimants: (roots: TscnNode[]) => Iterable<TscnNode>
): (scene: TscnScene, scope: TscnNode | null) => number {
  const tallies = new WeakMap<TscnNode[], Map<TscnNode | null, number>>();
  return (scene, scope) => {
    let tally = tallies.get(scene.nodes);
    if (!tally) {
      tally = new Map<TscnNode | null, number>();
      for (const claimant of claimants(scene.nodes)) {
        // A node whose viewport this file cannot determine is left out of the
        // contending set: `undefined` is never a scope a caller holds.
        const claimantScope = viewportScopeOf(scene, claimant);
        if (claimantScope === undefined) continue;
        tally.set(claimantScope, (tally.get(claimantScope) ?? 0) + 1);
      }
      tallies.set(scene.nodes, tally);
    }
    return tally.get(scope) ?? 0;
  };
}
