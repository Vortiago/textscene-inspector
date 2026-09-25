/**
 * What the semantic linters can know about the types of a node's direct children. A collision
 * shape and a vehicle wheel each attach through `cast_to<…>(get_parent())`, one level only, so a
 * child-presence rule asks about direct children and never walks the subtree.
 */

import type { TscnNode } from '../parser/types.js';
import { isTypeOpaque } from './parentType.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';

/**
 * Whether a direct child is one of `types`, a subclass included, since a subclass inherits the
 * attaching `_notification`. A child whose class this file cannot state counts too: an `instance=`
 * or override heading, or an uncatalogued GDExtension class, has its class elsewhere, and a missed
 * warning beats a false one, the call `resolveNodePath` makes.
 */
export function hasChildOfType(node: TscnNode, types: readonly string[]): boolean {
  return node.children.some(
    (child) => isTypeOpaque(child) || types.some((type) => descendsFrom(child.type, type))
  );
}
