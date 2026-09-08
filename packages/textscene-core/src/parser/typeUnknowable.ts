/**
 * Whether a heading tells us what its node really is.
 *
 * Lives in `parser/` rather than beside the linter's other tree questions
 * because BOTH trees ask it. The linter asks it about a rule's neighbour;
 * `sceneTreeBuilder` asks it at every descent of a `parent=` path, to tell a
 * name it cannot see from a name that is not there. A second spelling in the
 * parser would be a fourth copy of a test that has already drifted three times,
 * and the parser cannot import the linter anyway — the webview bundles the
 * lenient parser and ships none of the linter.
 */

import type { TscnNode } from './types.js';

/**
 * True when this node's `type` is not what it says, because the node comes from
 * a scene neither parser opens.
 *
 * Three ways that happens, and testing fewer than all three is a bug that reads
 * as correct:
 *
 * - `instance=` — the node IS another scene, whose root type lives there.
 * - no `type=` and no `instance=` — Godot's marker for "override the node
 *   already at this path", inside an instanced ancestor.
 * - a genuinely absent type on a malformed heading.
 *
 * The middle case is the trap. `NodeRegistry.ts:109` defaults a missing type to
 * `'Node'`, so an override heading parses as a confident, wrong `'Node'` and a
 * check of `!node.type` sails past it. That is not hypothetical: it made the
 * linter report a misplaced skeleton modifier on a shipped Godot demo, where a
 * `PhysicalBoneSimulator3D` hangs off a `Skeleton3D` override inside an
 * instanced character — and it made `buildSceneTree` strand every node parented
 * below an override heading, which is the shape Godot writes for editable
 * children.
 *
 * This is a function rather than three inline conditions because the inline
 * form had already been written five ways across the linter — parent-side and
 * child-side, some testing two arms, some one, one testing none — and fixing
 * the middle case in `parentTypeVerdict` did not fix it in
 * `visibleInTreeVerdict` sixty lines below, in the same commit.
 */
export function isTypeUnknowable(node: TscnNode): boolean {
  return Boolean(node.instance) || !node.type || Boolean(node.overridesExistingNode);
}
