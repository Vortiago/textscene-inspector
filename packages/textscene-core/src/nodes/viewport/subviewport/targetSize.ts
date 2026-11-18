/**
 * A sub-viewport's size in pixels: the one owner of the precedence and the clamp that every
 * sub-viewport pass, the container surface and the container's minimum size share.
 */

import type { ViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import { VIEWPORT_MIN_SIZE } from '../../../godot/rendering/viewport.js';
import { VECTOR2_ZERO, vector2Equals, type Vector2 } from '../../../godot/math/vector.js';
import type { TscnNode } from '../../../parser/types.js';
import { windowContentScale } from '../../windows/window/contentScale.js';
import type { WindowProperties } from '../../windows/window/types.js';
import { isEmbeddedWindow } from '../../../r3f/viewportRender/viewportBoundary.js';
import { warnOnce } from '../../../utils/warnOnce.js';
import type { SubViewportProperties } from './types.js';

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
 * The render target a viewport of `size` allocates. Godot leaves the ceiling to the GPU driver, but a
 * file Godot opens can hand `THREE.WebGLRenderTarget` a 2000000000-pixel axis.
 */
function cappedTargetSize(size: Vector2): Vector2 {
  return { x: Math.min(MAX_TEXTURE_EXTENT, size.x), y: Math.min(MAX_TEXTURE_EXTENT, size.y) };
}

/** Both sources are whole pixels already: the parser truncates `size`, and the container its rect. */
function flooredExtent(raw: number): number {
  return Number.isFinite(raw) ? Math.max(VIEWPORT_MIN_SIZE, raw) : VIEWPORT_MIN_SIZE;
}

/** The three sizes a viewport pass reads. */
export interface ViewportPassSizes {
  /** The pixels Godot renders, whose aspect the 3D camera takes (`renderer_viewport.cpp:318`). */
  render: Vector2;
  /** The render target's pixels, capped. */
  target: Vector2;
  /** The rect Controls lay out in: `get_visible_rect()`. */
  layout: Vector2;
  /** The canvas units the target shows: its pixels over the canvas scale. */
  view: Vector2;
}

/** An embedded window's canvas draws scaled by its content scale factor (`window.cpp:1362-1367`). */
export function viewportPassSizes(node: TscnNode, forced: ViewportRect | null): ViewportPassSizes {
  const size = viewportSize((node.properties as SubViewportProperties).size, forced);
  if (!isEmbeddedWindow(node.type))
    return subViewportPassSizes(size, node.properties as SubViewportProperties);
  const scale = windowContentScale(size, (node.properties as WindowProperties).content_scale);
  const render = viewportSize(scale.renderSize, null);
  return {
    render,
    target: cappedTargetSize(render),
    layout: scale.layoutSize,
    view: { x: render.x / scale.canvasScale, y: render.y / scale.canvasScale },
  };
}

/** The 2D override's visible rect and stretch (`viewport.cpp:1103-1105,1212-1214`). */
function subViewportPassSizes(size: Vector2, properties: SubViewportProperties): ViewportPassSizes {
  const { size_2d_override: override, size_2d_override_stretch: stretches } = properties;
  const hasOverride = !vector2Equals(override, VECTOR2_ZERO);
  const isStretched = stretches && override.x > 0 && override.y > 0;
  return {
    render: size,
    target: cappedTargetSize(size),
    layout: hasOverride ? override : size,
    view: isStretched ? override : size,
  };
}

/** The owner of the cap warnings: one per path and size, for the session. */
const CAPPED_TARGETS = {};

/** Logs once for each path whose target the cap makes smaller than Godot renders it. */
export function warnOfCappedTarget(
  path: string,
  { render, target }: Pick<ViewportPassSizes, 'render' | 'target'>
): void {
  if (vector2Equals(render, target)) return;
  warnOnce(
    CAPPED_TARGETS,
    `${path} ${render.x}x${render.y}`,
    `${path}: the ${render.x} x ${render.y} viewport is drawn at ${target.x} x ${target.y}, ` +
      'the largest texture WebGL allocates'
  );
}
