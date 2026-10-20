/**
 * The **Heading facts** about where each `[node]` heading's `parent=` placed it. The tree builder
 * seats what it can, and these name what Godot refuses. Only the linter reads them.
 */

import type { HeadingFacts, IdRecovery, NodeOrigin, RawNode } from '../parser/types.js';
import {
  emptyParentHeadings,
  refusesToInstantiate,
  rootDeclaringParent,
} from '../parser/instantiateRefusal.js';
import { orphanedNodes } from '../parser/sceneTreeBuilder.js';
import { idTrailEnd } from '../parser/idTrail.js';

type PlacementFacts = Pick<
  HeadingFacts,
  'orphanedNodes' | 'rootWithParent' | 'emptyParentHeadings' | 'refusesToInstantiate' | 'idRecoveries'
>;

/**
 * The placement facts of one scan: `origins` is every `[node]` heading in scan order, and `roots`
 * the tree built from them.
 */
export function placementFacts(
  origins: readonly NodeOrigin<RawNode>[],
  roots: readonly RawNode[]
): PlacementFacts {
  const orphans = orphanedNodes(origins, roots);
  return {
    orphanedNodes: orphans,
    rootWithParent: rootDeclaringParent(origins),
    emptyParentHeadings: emptyParentHeadings(origins),
    refusesToInstantiate: refusesToInstantiate(origins),
    idRecoveries: idRecoveries(origins, orphans),
  };
}

/**
 * The orphans whose `parent_id_path=` Godot follows to a node (`packed_scene.cpp:161-163`).
 * An orphan the trail does not recover is absent: Godot re-roots it.
 */
function idRecoveries(
  origins: readonly NodeOrigin<RawNode>[],
  orphaned: readonly NodeOrigin<RawNode>[]
): Map<NodeOrigin<RawNode>, IdRecovery> {
  const recoveries = new Map<NodeOrigin<RawNode>, IdRecovery>();
  const unplaced = new Set(orphaned);
  origins.forEach((origin, index) => {
    if (!unplaced.has(origin)) return;
    const end = idTrailEnd(origins, index, (heading) => !unplaced.has(heading));
    if (end) recoveries.set(origin, { kind: end.kind, via: origins[end.heading]! });
  });
  return recoveries;
}
