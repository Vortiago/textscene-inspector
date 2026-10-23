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
import { orphanedNodes, type SceneSeating } from '../parser/sceneTreeBuilder.js';
import { idTrailEnd } from '../parser/idTrail.js';

type PlacementFacts = Pick<
  HeadingFacts,
  | 'orphanedNodes'
  | 'reRootedNames'
  | 'rootWithParent'
  | 'emptyParentHeadings'
  | 'refusesToInstantiate'
  | 'idRecoveries'
  | 'nodeOrigins'
>;

/**
 * The placement facts of one scan: `origins` is every `[node]` heading in scan order, and `seating`
 * the tree built from them.
 */
export function placementFacts(
  origins: readonly NodeOrigin<RawNode>[],
  seating: SceneSeating<RawNode>
): PlacementFacts {
  const orphans = orphanedNodes(origins, seating);
  const isOrphan = new Set(orphans);
  return {
    orphanedNodes: orphans,
    reRootedNames: reRootedNames(orphans, seating),
    rootWithParent: rootDeclaringParent(origins),
    emptyParentHeadings: emptyParentHeadings(origins),
    refusesToInstantiate: refusesToInstantiate(origins),
    idRecoveries: idRecoveries(origins, isOrphan, seating),
    nodeOrigins: origins,
  };
}

/**
 * The orphans whose `parent_id_path=` Godot follows to a node (`packed_scene.cpp:161-163`).
 * An orphan the trail does not recover is absent: Godot re-roots it.
 */
function idRecoveries(
  origins: readonly NodeOrigin<RawNode>[],
  isOrphan: ReadonlySet<NodeOrigin<RawNode>>,
  { seated, pathOf }: SceneSeating<RawNode>
): Map<NodeOrigin<RawNode>, IdRecovery> {
  const recoveries = new Map<NodeOrigin<RawNode>, IdRecovery>();
  origins.forEach((origin, index) => {
    if (!isOrphan.has(origin)) return;
    const end = idTrailEnd(origins, index, (heading) => !isOrphan.has(heading));
    if (!end) return;
    const via = origins[end.heading]!;
    recoveries.set(origin, { kind: end.kind, via, viaPath: pathOf.get(seated.get(via.node)!) });
  });
  return recoveries;
}

function reRootedNames(
  orphaned: readonly NodeOrigin<RawNode>[],
  { seated }: SceneSeating<RawNode>
): Map<NodeOrigin<RawNode>, string> {
  const names = new Map<NodeOrigin<RawNode>, string>();
  for (const origin of orphaned) {
    const seat = seated.get(origin.node);
    if (seat) names.set(origin, seat.name);
  }
  return names;
}
