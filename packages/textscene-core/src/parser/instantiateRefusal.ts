/**
 * The headings that make Godot refuse to instantiate a scene, read from the order and spelling
 * of its `[node]` headings. Both the tree builder, which re-roots a vanished `parent=` only
 * where Godot gets that far, and the linter, which names each refusal, read them here.
 */

import type { NodeOrigin, RawNode } from './types.js';
import { rootStatesNoIdentifier } from './typeUnknowable.js';

/**
 * The first heading, when it declares a `parent=`: `packed_scene.cpp:219` refuses it,
 * so no scene builds. Positional, unlike `orphanedNodes`: the engine's root is
 * `i == 0`, while `buildSceneTree` prefers a parentless heading wherever it sits.
 */
export function rootDeclaringParent<N extends RawNode>(
  all: readonly NodeOrigin<N>[]
): NodeOrigin<N> | undefined {
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
export function emptyParentHeadings<N extends RawNode>(all: readonly NodeOrigin<N>[]): NodeOrigin<N>[] {
  return all.filter(({ declaredParent }) => declaredParent === '');
}

/**
 * Whether Godot gives up on the scene before it re-roots anything: heading 0 declares a
 * parent (`packed_scene.cpp:219`) or states no identifier (`:220`), a later heading declares
 * none (`:207`), or a heading spells `parent=""`, which faults the load.
 */
export function refusesToInstantiate<N extends RawNode>(all: readonly NodeOrigin<N>[]): boolean {
  const [root, ...later] = all;
  if (!root) return false;
  return (
    root.declaredParent !== undefined ||
    rootStatesNoIdentifier(root.node) ||
    later.some(({ declaredParent }) => declaredParent === undefined || declaredParent === '')
  );
}
