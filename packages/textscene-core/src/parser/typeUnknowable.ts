/**
 * Whether a heading says what its node is. In `parser/` because both trees ask
 * `isTypeUnknowable`, and the webview bundles the parser without the linter. The one other
 * reader of `overridesExistingNode` lives here too: `parentType.guard.test.ts` keeps it out of linter files.
 */

import type { RawNode } from './types.js';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/packedScene.js';

/**
 * True when the node comes from a scene neither parser opens, so its `type` is not
 * what it says: an `instance=` node, an override heading (no `type=`, no `instance=`),
 * or a malformed heading with no type. One function, so every caller tests all three.
 */
export function isTypeUnknowable(node: RawNode): boolean {
  // `NodeRegistry.ts:109` defaults a missing type to `'Node'`, so an override heading
  // passes `!node.type`. Godot writes that shape for editable children.
  return Boolean(node.instance) || !node.type || Boolean(node.overridesExistingNode);
}

/**
 * Whether the root heading states nothing Godot can build from. `:220` refuses a root
 * with none of `type=`, `instance=` and `instance_placeholder=`, and a placeholder root
 * fails at load (`resource_format_text.cpp:247-251`). It reads the heading's flag, not
 * `node.type`, which the node creators also synthesise from `instance=` and `index=`.
 */
export function rootStatesNoIdentifier(root: RawNode | undefined): boolean {
  return root?.overridesExistingNode === true || root?.type === INSTANCE_PLACEHOLDER_TYPE;
}
