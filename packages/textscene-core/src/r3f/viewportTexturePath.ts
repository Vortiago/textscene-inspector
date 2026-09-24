/**
 * Resolve a `ViewportTexture`'s `viewport_path` against the **local scene root**, not
 * the node holding the material, which is why such a material sets
 * `resource_local_to_scene = true`. No THREE and no React, so the linter can use it.
 */

import { parseNodePathLiteral } from '../parser/valueParsers.js';
import type { TscnNode } from '../parser/types.js';
import { resolveRelativePath } from '../utils/nodePath.js';
import {
  UNIQUE_NODE_PREFIX,
  isUniqueNameInOwner,
  type UniqueNameClaim,
} from '../utils/uniqueNames.js';

/**
 * `NodePath("FogOfWar/CombinedViewport")` to `'FogOfWar/CombinedViewport'`. Null, for
 * "this texture names no viewport", on an absent value, another literal or an empty path.
 */
export function resolveViewportTexturePath(value: string | undefined): string | null {
  const path = parseNodePathLiteral(value);
  if (path === null || path === '') return null;
  return path;
}

/**
 * Rebase a root-relative `viewport_path` onto the dispatcher-absolute key a
 * `<SubViewport>` publishes under: `NodePath("SubViewport")` means `Root/SubViewport`,
 * and the consumer path's first segment is that root. Null with no consumer path,
 * no viewport path, or an absolute `/root/…` one, which a static parse does not model.
 */
export function viewportTextureRegistryKey(
  consumerPath: string | null,
  viewportPath: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  if (!consumerPath || viewportPath === '') return null;
  const root = consumerPath.split('/')[0];
  if (!root) return null;
  // `NodePath(".")` names the viewport itself: the scene root here, not a child.
  if (viewportPath === '.') return root;
  if (viewportPath.startsWith('/')) return null;
  // A `%Name` segment is a jump through the consumer's owner's claim table
  // (`uniqueNameLivePaths`). A name it lacks addresses nothing (node.cpp:1930-1938),
  // never the literal join, which could hit another owner's alias. Without a table,
  // the literal join is all there is.
  if (uniquePaths && viewportPath.includes(UNIQUE_NODE_PREFIX)) {
    return resolveRelativePath(root, viewportPath, uniquePaths);
  }
  return `${root}/${viewportPath}`;
}

/**
 * The second key a claimed unique name publishes under, or null. `NodePath("%Name")`
 * resolves with `get_node_or_null` (viewport.cpp:198), so it spells the same viewport:
 * the alias serves a consumer with no claim table, which joins the literal to the
 * root. A consumer with a table resolves the jump to the publisher's own path.
 */
export function viewportTextureUniqueNameKey(
  node: TscnNode,
  path: string,
  claims?: ReadonlyMap<string, UniqueNameClaim>
): string | null {
  if (!isUniqueNameInOwner(node)) return null;
  const key = `${UNIQUE_NODE_PREFIX}${node.name}`;
  // The flag is a claim: `_acquire_unique_name_in_owner` keeps the first claimant and
  // clears a later one's flag (node.cpp:2225-2231). A loser that publishes leaves the
  // registry to whichever mounts last. Matched on `livePath`, the only spelling that
  // survives instanced composition. A node absent from the table, or no table, publishes.
  const winner = claims?.get(key);
  if (winner !== undefined && winner.livePath !== path) return null;
  const root = path.split('/')[0];
  return root ? `${root}/${key}` : null;
}
