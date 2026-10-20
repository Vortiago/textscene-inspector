/**
 * Which owner a node's `%Name` lands on. `_acquire_unique_name_in_owner` (node.cpp:2222) registers
 * `"%" + name` on the node's owner and refuses to overwrite an entry (node.cpp:2225-2231), so the
 * first claimant wins and a `%Name` with no claimant addresses nothing.
 */

import type { RawNode } from './types.js';
import { boolSlotValue } from '../godot/variant/variantBool.js';
import { UNIQUE_NODE_PREFIX } from '../godot/string/nodePath.js';

/**
 * Whether a node claims a `%Name` in its owner: `unique_name_in_owner = true`, read from
 * `rawProperties` alone, which both parsers publish alike (`parser/rawPropertyParity.test.ts`). No
 * slice models the flag, so typed `properties` lacks it. `PROPERTY_USAGE_NO_EDITOR` hides it and
 * still serialises it (node.cpp:4050).
 */
export function isUniqueNameInOwner(node: RawNode): boolean {
  return boolSlotValue(node.rawProperties.unique_name_in_owner) === true;
}

/**
 * Whether a node is an instance that hides its sub-scene's owner from the nodes below it. An
 * instanced root is the scene's own root, so only an instance below the root does.
 */
export function isInstanceBelowRoot(node: RawNode, isRoot: boolean): boolean {
  return !isRoot && Boolean(node.instance);
}

/**
 * Whether the scene root owns a node, so its `%Name` lands in the root's table. An explicit `owner=`
 * decides: `"."` is the root. Without one, an override heading inside an instance keeps the sub-scene's
 * owner (resource_format_text.cpp:264-265 zeroes `owner` only when `!(type == TYPE_INSTANTIATED &&
 * instance == -1)`), and every other node is the root's.
 */
export function isOwnedByRoot(node: RawNode, insideInstance: boolean): boolean {
  if (node.owner !== undefined) return node.owner === '.';
  return !(insideInstance && node.overridesExistingNode === true);
}

/**
 * Records `value` under `%name` unless an earlier node claimed it: `_acquire_unique_name_in_owner`
 * refuses to overwrite an entry (node.cpp:2225-2231). The one place the first-claimant rule lives.
 */
export function claimUniqueName<V>(claims: Map<string, V>, name: string, value: V): void {
  const key = UNIQUE_NODE_PREFIX + name;
  if (!claims.has(key)) claims.set(key, value);
}
