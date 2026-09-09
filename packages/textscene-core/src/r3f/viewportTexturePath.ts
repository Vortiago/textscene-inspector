/**
 * Resolve a `ViewportTexture`'s `viewport_path` to a scene-tree node path.
 *
 * Godot resolves this against the **local scene root**, not against the node
 * that holds the material — which is precisely why a material carrying a
 * ViewportTexture must set `resource_local_to_scene = true` (each instance of
 * the scene needs its own copy, bound to its own root). Resolving relative to
 * the consumer instead would make `gui_in_3d`'s `NodePath("SubViewport")` look
 * for a sub-viewport under the quad, and find nothing.
 *
 * Pure `.ts`, no THREE and no React, so the linter can use it too.
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
 * `NodePath("FogOfWar/CombinedViewport")` → `'FogOfWar/CombinedViewport'`.
 * Returns null for an absent value, a non-NodePath literal, or an empty path —
 * callers treat null as "this texture names no viewport".
 */
export function resolveViewportTexturePath(value: string | undefined): string | null {
  const path = parseNodePathLiteral(value);
  if (path === null || path === '') return null;
  return path;
}

/**
 * Rebase a root-relative `viewport_path` onto the key a `<SubViewport>` really
 * publishes under.
 *
 * The registry is keyed by the DISPATCHER-ABSOLUTE path — the scene root is its
 * own name, children join with `/` (`NodeDispatcher` starts each top-level node
 * at `path={node.name}`) — whereas `viewport_path` counts from the local scene
 * root, so `NodePath("SubViewport")` means `Root/SubViewport`. The consumer's
 * own path already begins at that root, so its first segment supplies it and no
 * further context is needed.
 *
 * A `%Name` segment is a JUMP, not a literal name: `get_node_or_null` looks it
 * up in the owner's claim table and DESCENDS from whatever it finds, so
 * `NodePath("%Hud/CombinedViewport")` addresses a node under the `%Hud`
 * claimant. `uniquePaths` is the CONSUMER'S OWNER'S table reduced to live paths
 * (`uniqueNameLivePaths`), which is how the registry spells its keys, and a
 * `%Name` it lacks addresses nothing (node.cpp:1930-1938) — null, never the
 * literal join, which would hit the alias a sub-viewport under another owner
 * publishes for itself.
 *
 * Without a claim table the literal join stands: outside the shell the alias a
 * publisher registers for its own single-segment `%Name` is all there is.
 *
 * Returns null when there is no consumer path (mounted outside a
 * `NodePathProvider`), no viewport path, or an absolute one — `/root/…`
 * measures from the live SceneTree, which a static parse does not model. Better
 * to resolve nothing than to key the registry at a path nobody published.
 */
export function viewportTextureRegistryKey(
  consumerPath: string | null,
  viewportPath: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  if (!consumerPath || viewportPath === '') return null;
  const root = consumerPath.split('/')[0];
  if (!root) return null;
  // `NodePath(".")` names the viewport itself — the scene root here, not a child.
  if (viewportPath === '.') return root;
  if (viewportPath.startsWith('/')) return null;
  if (uniquePaths && viewportPath.includes(UNIQUE_NODE_PREFIX)) {
    return resolveRelativePath(root, viewportPath, uniquePaths);
  }
  return `${root}/${viewportPath}`;
}

/**
 * The second key a viewport publishes under when it claims a unique name, or null.
 *
 * `viewport_path` is resolved with `get_node_or_null` (viewport.cpp:198), so
 * `NodePath("%Name")` addresses the same viewport as its path does — a second
 * spelling, not a second viewport. A consumer with no claim table builds its
 * key by joining the literal to the scene root (`viewportTextureRegistryKey`),
 * so the publisher answers it by registering that join too; one with a table
 * resolves the jump to the publisher's own path and never reads the alias.
 *
 * The flag on the node is a CLAIM, not the answer. Two nodes may both carry it
 * with the same name, and `_acquire_unique_name_in_owner` refuses to overwrite
 * an existing entry — the first registers and the later node has its own flag
 * cleared (node.cpp:2225-2231). `claims` is that resolved table, `%Name` to the
 * winner, and a loser publishing the alias anyway meant the registry kept
 * whichever mounted LAST: a consumer quad sampling the wrong sub-viewport.
 *
 * Matched on the claim's `livePath` — where the node sits once instanced content
 * is composed in, which is how the render path this publisher carries is spelled.
 * Neither of the other two spellings survives that composition: the authored
 * `path` lacks the grafted segments, and node identity is lost because both the
 * Instance root merge and the graft hand the publisher a fresh object.
 *
 * Absent from the table is not the same as losing: an entry the table has no
 * opinion about is published as before, as is every caller with no table at
 * all — outside the shell there is no tree to resolve against, and the alias
 * is the only key a bare `%Name` can reach there.
 */
export function viewportTextureUniqueNameKey(
  node: TscnNode,
  path: string,
  claims?: ReadonlyMap<string, UniqueNameClaim>
): string | null {
  if (!isUniqueNameInOwner(node)) return null;
  const key = `${UNIQUE_NODE_PREFIX}${node.name}`;
  const winner = claims?.get(key);
  if (winner !== undefined && winner.livePath !== path) return null;
  const root = path.split('/')[0];
  return root ? `${root}/${key}` : null;
}
