/**
 * Resolve a `ViewportTexture`'s `viewport_path` against the **local scene root**, not
 * the node holding the material, which is why such a material sets
 * `resource_local_to_scene = true`. No THREE and no React, so the linter can use it.
 */

import { parseNodePathLiteral } from '../parser/valueParsers.js';
import { resolveRelativePath } from '../godot/nodePath.js';

/**
 * `NodePath("FogOfWar/CombinedViewport")` to `'FogOfWar/CombinedViewport'`. Null, for
 * "this texture names no viewport", on an absent value, another literal or an empty path.
 */
export function resolveViewportTexturePath(value: string | undefined): string | null {
  return parseNodePathLiteral(value) || null;
}

/**
 * Rebase a `viewport_path` onto the dispatcher-absolute key a `<SubViewport>` publishes
 * under: `NodePath("SubViewport")` from the local scene root `Root` means `Root/SubViewport`.
 * The path is walked as `get_node_or_null` walks it (viewport.cpp:198), and a `%Name` jumps
 * through `uniquePaths`, the local scene's claim table. Null with no local scene root, no
 * viewport path, an absolute `/root/…` one, or a walk that reaches nothing.
 */
export function viewportTextureRegistryKey(
  localRootPath: string | null,
  viewportPath: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  if (!localRootPath || viewportPath === '') return null;
  return resolveRelativePath(localRootPath, viewportPath, uniquePaths);
}
