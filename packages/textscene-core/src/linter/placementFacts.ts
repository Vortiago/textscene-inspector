/**
 * The **Heading facts** about where each `[node]` heading's `parent=` placed it. The tree builder
 * seats what it can, and these name what Godot refuses. Only the linter reads them.
 */

import type { HeadingFacts, IdRecovery, NodeOrigin, RawNode } from '../parser/types.js';
import { strandedNodes } from '../parser/sceneTreeBuilder.js';
import { INSTANCE_PLACEHOLDER_TYPE, recoverByIdTrail, type IdHeading } from '../godot/scene/packedScene.js';

type PlacementFacts = Pick<
  HeadingFacts,
  'orphanedNodes' | 'rootWithParent' | 'emptyParentHeadings' | 'idRecoveries' | 'idHeadings'
>;

/**
 * The placement facts of one scan: `origins` is every `[node]` heading in scan order, and `roots`
 * the tree built from them.
 */
export function placementFacts(
  origins: readonly NodeOrigin<RawNode>[],
  roots: readonly RawNode[]
): PlacementFacts {
  const orphanedNodes = strandedNodes(origins, roots);
  const headings = idHeadings(origins, orphanedNodes);
  return {
    orphanedNodes,
    rootWithParent: rootDeclaringParent(origins),
    emptyParentHeadings: emptyParentHeadings(origins),
    idRecoveries: idRecoveries(origins, orphanedNodes, headings),
    idHeadings: headings,
  };
}

/** Each heading as `recoverByIdTrail` reads it: placed unless the tree build stranded it. */
function idHeadings(
  origins: readonly NodeOrigin<RawNode>[],
  orphaned: readonly NodeOrigin<RawNode>[]
): IdHeading[] {
  const unplaced = new Set(orphaned);
  return origins.map((origin) => ({
    uniqueId: origin.uniqueId,
    instance: instanceKind(origin.node),
    isPlaced: !unplaced.has(origin),
  }));
}

/**
 * The orphans whose `parent_id_path=` Godot follows to a node (`packed_scene.cpp:161-163`).
 * An orphan the trail does not recover is absent: Godot re-roots it.
 */
function idRecoveries(
  origins: readonly NodeOrigin<RawNode>[],
  orphaned: readonly NodeOrigin<RawNode>[],
  headings: readonly IdHeading[]
): Map<NodeOrigin<RawNode>, IdRecovery> {
  const recoveries = new Map<NodeOrigin<RawNode>, IdRecovery>();
  const unplaced = new Set(orphaned);
  origins.forEach((origin, index) => {
    if (!unplaced.has(origin) || origin.idTrail === undefined) return;
    const end = recoverByIdTrail(origin.idTrail, headings, index);
    if (end) recoveries.set(origin, { kind: end.kind, via: origins[end.heading]! });
  });
  return recoveries;
}

function instanceKind(node: RawNode): IdHeading['instance'] {
  if (node.type === INSTANCE_PLACEHOLDER_TYPE) return 'placeholder';
  return node.instance === undefined ? undefined : 'scene';
}

/**
 * The first heading, when it declares a `parent=`: `packed_scene.cpp:219` refuses it,
 * so no scene builds. Positional, unlike `strandedNodes`: the engine's root is
 * `i == 0`, while `buildSceneTree` prefers a parentless heading wherever it sits.
 */
function rootDeclaringParent(all: readonly NodeOrigin<RawNode>[]): NodeOrigin<RawNode> | undefined {
  // The declared attribute, not `node.parent`, which is unset for `parent=""`:
  // `add_node_path` indexes any value (`packed_scene.cpp:2307-2311`), so an empty one
  // still reaches the refusal.
  const first = all[0];
  return first?.declaredParent === undefined ? undefined : first;
}

/**
 * Every heading spelling `parent=""`. `prepend_period()` (resource_format_text.cpp:206-207)
 * dereferences the `data` an empty NodePath never allocates (`node_path.cpp:43-44`,
 * `:394-397`), so the load faults. Positional like {@link rootDeclaringParent}: the
 * builder may root such a heading as readily as strand it.
 */
function emptyParentHeadings(all: readonly NodeOrigin<RawNode>[]): NodeOrigin<RawNode>[] {
  return all.filter(({ declaredParent }) => declaredParent === '');
}
