/**
 * A sub-viewport's size in pixels: the one owner of the precedence and the clamp that every
 * sub-viewport pass, the container surface and the container's minimum size share.
 */

import type { Vector2 } from '../../base/node2d/types';
import type { ViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import { VIEWPORT_MIN_SIZE } from '../../../godot/index.js';

/**
 * Godot's `Viewport::get_size()`. A stretching `SubViewportContainer`'s forced rect wins over the
 * authored `size`, since `set_size_force` overwrites it (`subviewport_container.cpp:94`). Null
 * `forced` means no stretching container, so the authored size stands, as in Godot's early return
 * (`:83-85`). Each axis floors at `VIEWPORT_MIN_SIZE`.
 */
export function viewportSize(authored: Vector2, forced: ViewportRect | null): Vector2 {
  const size = forced ?? authored;
  return { x: flooredExtent(size.x), y: flooredExtent(size.y) };
}

/**
 * The render target `viewportSize` allocates. Godot leaves the ceiling to the GPU driver, but a
 * file Godot opens can hand `THREE.WebGLRenderTarget` a 2000000000-pixel axis.
 */
export function viewportTargetSize(authored: Vector2, forced: ViewportRect | null): Vector2 {
  const size = viewportSize(authored, forced);
  return { x: Math.min(MAX_TEXTURE_EXTENT, size.x), y: Math.min(MAX_TEXTURE_EXTENT, size.y) };
}

/** Both sources are whole pixels already: the parser truncates `size`, and the container its rect. */
function flooredExtent(raw: number): number {
  return Number.isFinite(raw) ? Math.max(VIEWPORT_MIN_SIZE, raw) : VIEWPORT_MIN_SIZE;
}
