/**
 * Whether a heading says what its node is. In `parser/` because both trees ask: the
 * linter about a rule's neighbour, `sceneTreeBuilder` at every `parent=` descent. The
 * parser cannot import the linter, since the webview bundles the parser alone.
 */

import type { TscnNode } from './types.js';

/**
 * True when the node comes from a scene neither parser opens, so its `type` is not
 * what it says: an `instance=` node, an override heading (no `type=`, no `instance=`),
 * or a malformed heading with no type. One function, so every caller tests all three.
 */
export function isTypeUnknowable(node: TscnNode): boolean {
  // `NodeRegistry.ts:109` defaults a missing type to `'Node'`, so an override heading
  // passes `!node.type`. Godot writes that shape for editable children.
  return Boolean(node.instance) || !node.type || Boolean(node.overridesExistingNode);
}
