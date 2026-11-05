/**
 * A sub-viewport's size in pixels: the one owner of the precedence and the clamp that every
 * sub-viewport pass, the container surface and the container's minimum size share.
 */

import type { ViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import { VIEWPORT_MIN_SIZE } from '../../../godot/rendering/viewport.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import type { TscnNode } from '../../../parser/types.js';
import { windowContentScale, type ContentScale } from '../../windows/window/contentScale.js';
import type { WindowProperties } from '../../windows/window/types.js';
import { isEmbeddedWindow } from './viewportBoundary.js';
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
  /** The render target's pixels, capped. */
  target: Vector2;
  /** The rect Controls lay out in: `get_visible_rect()`. */
  layout: Vector2;
  /** The canvas units the target shows: its pixels over the canvas scale. */
  view: Vector2;
}

/** A SubViewport's content: drawn 1:1, as a window with every `content_scale_*` key unset. */
const UNSCALED: ContentScale = { mode: 0, aspect: 0, stretch: 0, size: { x: 0, y: 0 }, factor: 1 };

function contentScaleOf(node: TscnNode): ContentScale {
  return isEmbeddedWindow(node.type) ? (node.properties as WindowProperties).content_scale : UNSCALED;
}

/**
 * A viewport renders and lays out by its content scale (`contentScale.ts`), and its canvas draws
 * scaled by the factor, so the target shows its pixels over the factor in canvas units
 * (`window.cpp:1362-1367`).
 */
export function viewportPassSizes(node: TscnNode, forced: ViewportRect | null): ViewportPassSizes {
  const size = viewportSize((node.properties as SubViewportProperties).size, forced);
  const scale = windowContentScale(size, contentScaleOf(node));
  const render = viewportSize(scale.renderSize, null);
  return {
    target: cappedTargetSize(render),
    layout: scale.layoutSize,
    view: { x: render.x / scale.canvasScale, y: render.y / scale.canvasScale },
  };
}
