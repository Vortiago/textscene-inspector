/**
 * The **Heading facts** about where each `[node]` heading's `parent=` placed it. The tree builder
 * seats what it can, and these name what Godot refuses. Only the linter reads them.
 */

import type { HeadingFacts, NodeOrigin, RawNode } from '../parser/types.js';
import { strandedNodes } from '../parser/sceneTreeBuilder.js';

type PlacementFacts = Pick<HeadingFacts, 'orphanedNodes' | 'rootWithParent' | 'emptyParentHeadings'>;

/**
 * The placement facts of one scan: `origins` is every `[node]` heading in scan order, and `roots`
 * the tree built from them.
 */
export function placementFacts(
  origins: readonly NodeOrigin<RawNode>[],
  roots: readonly RawNode[]
): PlacementFacts {
  return {
    orphanedNodes: strandedNodes(origins, roots),
    rootWithParent: rootDeclaringParent(origins),
    emptyParentHeadings: emptyParentHeadings(origins),
  };
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
