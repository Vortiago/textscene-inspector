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
import { orphanedNodes, type SceneTree } from '../parser/sceneTreeBuilder.js';
import { idHeadingsOf, idTrailEnd } from '../parser/idTrail.js';

type PlacementFacts = Pick<
  HeadingFacts,
  | 'orphanedNodes'
  | 'reRootedNames'
  | 'rootWithParent'
  | 'emptyParentHeadings'
  | 'refusesToInstantiate'
  | 'idRecoveries'
  | 'idHeadings'
>;

/**
 * The placement facts of one scan: `origins` is every `[node]` heading in scan order, and `tree`
 * the tree built from them.
 */
export function placementFacts(
  origins: readonly NodeOrigin<RawNode>[],
  tree: SceneTree<RawNode>
): PlacementFacts {
  const orphans = orphanedNodes(origins, tree);
  return {
    orphanedNodes: orphans,
    reRootedNames: reRootedNames(orphans, tree),
    rootWithParent: rootDeclaringParent(origins),
    emptyParentHeadings: emptyParentHeadings(origins),
    refusesToInstantiate: refusesToInstantiate(origins),
    idRecoveries: idRecoveries(origins, orphans, tree),
    // Every heading is built by the time connections are made (`packed_scene.cpp:647-660`).
    idHeadings: idHeadingsOf(origins, ({ node }) => tree.seated.has(node)),
  };
}

/**
 * The orphans whose `parent_id_path=` Godot follows to a node (`packed_scene.cpp:161-163`).
 * An orphan the trail does not recover is absent: Godot re-roots it.
 */
function idRecoveries(
  origins: readonly NodeOrigin<RawNode>[],
  orphaned: readonly NodeOrigin<RawNode>[],
  { seated, pathOf }: SceneTree<RawNode>
): Map<NodeOrigin<RawNode>, IdRecovery> {
  const recoveries = new Map<NodeOrigin<RawNode>, IdRecovery>();
  const unseatedByPath = new Set(orphaned);
  origins.forEach((origin, index) => {
    if (!unseatedByPath.has(origin)) return;
    const end = idTrailEnd(origins, index, (heading) => !unseatedByPath.has(heading));
    if (!end) return;
    const via = origins[end.heading]!;
    recoveries.set(origin, { kind: end.kind, via, viaPath: pathOf.get(seated.get(via.node)!) });
  });
  return recoveries;
}

function reRootedNames(
  orphaned: readonly NodeOrigin<RawNode>[],
  { seated }: SceneTree<RawNode>
): Map<NodeOrigin<RawNode>, string> {
  const names = new Map<NodeOrigin<RawNode>, string>();
  for (const origin of orphaned) {
    const seat = seated.get(origin.node);
    if (seat) names.set(origin, seat.name);
  }
  return names;
}
