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
