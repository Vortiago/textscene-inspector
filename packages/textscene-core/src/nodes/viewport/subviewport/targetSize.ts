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

/** What a viewport hands `Viewport::_set_size` (`viewport.cpp:1100`), and the factor of a window. */
interface SetSizeArguments {
  size: Vector2;
  sizeOverride: Vector2;
  stretches: boolean;
  /** The content scale factor of an embedded window, 1 for any other viewport. */
  factor: number;
}

/** A SubViewport passes its own properties, a window what its content scale gives (`window.cpp:1351`). */
function setSizeArguments(node: TscnNode, forced: ViewportRect | null): SetSizeArguments {
  const properties = node.properties as SubViewportProperties;
  const size = viewportSize(properties.size, forced);
  if (!isEmbeddedWindow(node.type)) {
    const { size_2d_override: sizeOverride, size_2d_override_stretch: stretches } = properties;
    return { size, sizeOverride, stretches, factor: 1 };
  }
  const scale = windowContentScale(size, (node.properties as WindowProperties).content_scale);
  // A window always stretches its 2D override (`viewport.h:727`).
  return {
    size: viewportSize(scale.renderSize, null),
    sizeOverride: scale.sizeOverride,
    stretches: true,
    factor: scale.canvasScale,
  };
}

/** The canvas units the size shows: the 2D override where it stretches (`viewport.cpp:1103-1105`). */
function stretchedView({ size, sizeOverride, stretches }: SetSizeArguments): Vector2 {
  return stretches && sizeOverride.x > 0 && sizeOverride.y > 0 ? sizeOverride : size;
}

/** `get_visible_rect()`: the 2D override where one is set (`viewport.cpp:1212-1214`). */
function visibleSize({ size, sizeOverride }: SetSizeArguments): Vector2 {
  return vector2Equals(sizeOverride, VECTOR2_ZERO) ? size : sizeOverride;
}

/** The rect the viewport's Controls lay out in, which its embedder's stretch leaves as it is. */
export function viewportLayoutSize(node: TscnNode, forced: ViewportRect | null): Vector2 {
  return visibleSize(setSizeArguments(node, forced));
}

/** The smaller axis of the stretch transform, which the windows it embeds render at (`window.cpp:1363`). */
export function embedderStretch(node: TscnNode, forced: ViewportRect | null): number {
  const args = setSizeArguments(node, forced);
  const view = stretchedView(args);
  return Math.min(args.size.x / view.x, args.size.y / view.y);
}

/** An embedded window renders at its embedder's stretch, its canvas at that times its factor. */
export function viewportPassSizes(
  node: TscnNode,
  forced: ViewportRect | null,
  stretchOfEmbedder: number
): ViewportPassSizes {
  const args = setSizeArguments(node, forced);
  const layout = visibleSize(args);
  if (!isEmbeddedWindow(node.type)) {
    return { render: args.size, target: cappedTargetSize(args.size), layout, view: stretchedView(args) };
  }
  const render = {
    x: Math.ceil(args.size.x * stretchOfEmbedder),
    y: Math.ceil(args.size.y * stretchOfEmbedder),
  };
  // The ceiling of the stretched size, and the stretch on the canvas transform (`window.cpp:1364-1366`).
  const canvasScale = stretchOfEmbedder * args.factor;
  const view = { x: render.x / canvasScale, y: render.y / canvasScale };
  return { render, target: cappedTargetSize(render), layout, view };
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
