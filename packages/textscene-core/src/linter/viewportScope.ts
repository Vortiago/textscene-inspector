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
  // The current-camera slot is `get_viewport()`'s (node.cpp:345-347), for 2D
  // (camera_2d.cpp:342) and 3D (camera_3d.cpp:186) alike. `Window` is a Viewport
  // (window.h:43), so the base chain scopes a dialog too.
  const search = searchAncestors(scene, node, (ancestor) =>
    // `visit` gets only ancestors whose type this file states and the catalog knows.
    descendsFrom(ancestor.type, 'Viewport') ? ancestor : undefined
  );
  if (search.kind === 'unknowable') return undefined;
  return search.kind === 'found' ? search.value : null;
}
