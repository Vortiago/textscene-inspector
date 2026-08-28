/**
 * `%Name` claims over an authored tree — the one place that decides which node a
 * unique name addresses.
 *
 * `_acquire_unique_name_in_owner` (node.cpp:2222) registers `"%" + name` on the
 * node's OWNER, which for a `.tscn` is the scene root, and refuses to overwrite
 * an existing entry (node.cpp:2225-2231): the first claimant keeps the name and
 * the later one has its flag cleared. So the claim table is exactly the nodes in
 * this file carrying the flag, first one wins, and a `%Name` with no claimant
 * really does address nothing.
 *
 * Shared by the linter's NodePath walk and the render path's relay/`path_node`
 * resolution. Both ask the same question, and two copies would answer it
 * differently on the tree shape each happens to hold.
 */

import type { TscnNode } from '../parser/types.js';
import { boolSlotValue } from '../godot/index.js';

/** `UNIQUE_NODE_PREFIX` (string_name.h:36). */
export const UNIQUE_NODE_PREFIX = '%';

/** The node a `%Name` addresses, with the path that reaches it. */
export interface UniqueNameClaim {
  readonly node: TscnNode;
  readonly path: string;
}

/**
 * `unique_name_in_owner = true` on this node (node.cpp:4050 — `PROPERTY_USAGE_NO_EDITOR`
 * hides it from the inspector and still serialises it).
 *
 * `rawProperties` and nothing else: both parsers publish the raw bag there
 * (`parser/rawPropertyParity.test.ts`), and it is the only field whose meaning
 * does not depend on which one produced the node. No slice models this flag, so
 * on the render tree the typed `properties` never carries it at all.
 */
export function isUniqueNameInOwner(node: TscnNode): boolean {
  return boolSlotValue(node.rawProperties?.unique_name_in_owner) === true;
}

/**
 * Every `%Name` claimed in `roots`, depth-first, keyed with the prefix already on.
 *
 * Paths are joined the way the render path's own walks spell them, so a caller can
 * look the result straight up in its `nodeByPath` map.
 */
export function uniqueNameClaims(roots: readonly TscnNode[]): Map<string, UniqueNameClaim> {
  const claims = new Map<string, UniqueNameClaim>();
  const walk = (nodes: readonly TscnNode[], parentPath: string): void => {
    for (const node of nodes) {
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      const key = UNIQUE_NODE_PREFIX + node.name;
      if (isUniqueNameInOwner(node) && !claims.has(key)) claims.set(key, { node, path });
      walk(node.children, path);
    }
  };
  walk(roots, '');
  return claims;
}

/**
 * {@link uniqueNameClaims} reduced to `%Name` -> path, which is what a caller
 * holding a path-keyed node map needs to finish a NodePath walk.
 */
export function uniqueNamePaths(roots: readonly TscnNode[]): Map<string, string> {
  const paths = new Map<string, string>();
  for (const [key, claim] of uniqueNameClaims(roots)) paths.set(key, claim.path);
  return paths;
}
