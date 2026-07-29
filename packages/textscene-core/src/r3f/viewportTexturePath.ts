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
 * Returns null when there is no consumer path (mounted outside a
 * `NodePathProvider`) or no viewport path — better to resolve nothing than to
 * key the registry at a path nobody published.
 */
export function viewportTextureRegistryKey(
  consumerPath: string | null,
  viewportPath: string
): string | null {
  if (!consumerPath || viewportPath === '') return null;
  const root = consumerPath.split('/')[0];
  if (!root) return null;
  // `NodePath(".")` names the viewport itself — the scene root here, not a child.
  if (viewportPath === '.') return root;
  return `${root}/${viewportPath}`;
}
