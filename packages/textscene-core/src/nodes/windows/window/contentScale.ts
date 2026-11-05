/**
 * An embedded window's content scale: `Window::_update_viewport_size` (`window.cpp:1232-1370`) and
 * the rect its embedder draws the target in (`viewport.cpp:395-400`). The embedder's own stretch is
 * 1, as the root viewport here applies none. Pure: no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { isEqualApprox } from '../../../godot/math/math';
import { storedReal } from '../../../godot/math/real';
import { ContentScaleAspect, ContentScaleMode, ContentScaleStretch } from '../../../godot/scene/window';

/** The `content_scale_*` properties of a window. */
export interface ContentScale {
  mode: number;
  aspect: number;
  stretch: number;
  size: Vector2;
  factor: number;
}

/** A window with every `content_scale_*` key unset (`window.h:126-140`): its content drawn 1:1. */
export const DEFAULT_CONTENT_SCALE: Readonly<ContentScale> = {
  mode: ContentScaleMode.DISABLED,
  aspect: ContentScaleAspect.IGNORE,
  stretch: ContentScaleStretch.FRACTIONAL,
  size: { x: 0, y: 0 },
  factor: 1,
};

export interface WindowViewportScale {
  /** The target's pixels: `final_size`. */
  renderSize: Vector2;
  /** The rect the Controls lay out in: `get_visible_rect()`, the 2D override when one is set. */
  layoutSize: Vector2;
  /** The canvas transform's scale: the content scale factor (`window.cpp:1366`). */
  canvasScale: number;
  /** Where the embedder draws the target, from the window's top-left. Bars fill the rest of the window. */
  drawRect: Rect2;
}

/** `content_scale_factor` as the integer stretch leaves it (`window.cpp:1240-1249`). */
function effectiveFactor({ stretch, factor }: ContentScale): number {
  if (stretch !== ContentScaleStretch.INTEGER) return factor;
  return Math.max(1, Math.floor(factor));
}

/** The design size and the screen rect it fits into, before the mode picks between them (`:1255-1312`). */
function fitDesignSize(size: Vector2, scale: ContentScale): { viewport: Vector2; screen: Vector2 } {
  const desired = scale.size;
  const viewportAspect = storedReal(desired.x / desired.y);
  const videoAspect = storedReal(size.x / size.y);
  let viewport: Vector2;
  let screen: Vector2;
  if (scale.aspect === ContentScaleAspect.IGNORE || isEqualApprox(viewportAspect, videoAspect)) {
    viewport = desired;
    screen = size;
  } else if (viewportAspect < videoAspect) {
    if (scale.aspect === ContentScaleAspect.KEEP_HEIGHT || scale.aspect === ContentScaleAspect.EXPAND) {
      viewport = { x: storedReal(desired.y * videoAspect), y: desired.y };
      screen = size;
    } else {
      viewport = desired;
      screen = { x: storedReal(size.y * viewportAspect), y: size.y };
    }
  } else if (scale.aspect === ContentScaleAspect.KEEP_WIDTH || scale.aspect === ContentScaleAspect.EXPAND) {
    viewport = { x: desired.x, y: storedReal(desired.x / videoAspect) };
    screen = size;
  } else {
    viewport = desired;
    screen = { x: size.x, y: storedReal(size.x / viewportAspect) };
  }
  screen = { x: Math.floor(screen.x), y: Math.floor(screen.y) };
  viewport = { x: Math.floor(viewport.x), y: Math.floor(viewport.y) };
  if (scale.stretch === ContentScaleStretch.INTEGER) {
    const multiple = Math.max(
      1,
      Math.min(Math.floor(screen.x / viewport.x), Math.floor(screen.y / viewport.y))
    );
    screen = { x: viewport.x * multiple, y: viewport.y * multiple };
  }
  return { viewport, screen };
}

/** The bars' half on each axis: `margin` (`:1314-1325`). */
function barMargin(size: Vector2, screen: Vector2): Vector2 {
  return {
    x: screen.x < size.x ? Math.round((size.x - screen.x) / 2) : 0,
    y: screen.y < size.y ? Math.round((size.y - screen.y) / 2) : 0,
  };
}

/**
 * A mode the switch names no case for leaves `final_size` at zero (`window.cpp:1263-1347`). The
 * target shows nothing, so the bars fill the whole window.
 */
function unknownModeScale(factor: number): WindowViewportScale {
  const none = { x: 0, y: 0 };
  return { renderSize: none, layoutSize: none, canvasScale: factor, drawRect: { x: 0, y: 0, w: 0, h: 0 } };
}

/** How the window at `size` renders and lays out its content, and where its embedder draws it. */
export function windowContentScale(size: Vector2, scale: ContentScale): WindowViewportScale {
  const factor = effectiveFactor(scale);
  const whole: Rect2 = { x: 0, y: 0, w: size.x, h: size.y };
  if (scale.mode === ContentScaleMode.DISABLED || scale.size.x === 0 || scale.size.y === 0) {
    const layoutSize = { x: storedReal(size.x / factor), y: storedReal(size.y / factor) };
    return { renderSize: size, layoutSize, canvasScale: factor, drawRect: whole };
  }
  const { viewport, screen } = fitDesignSize(size, scale);
  const margin = barMargin(size, screen);
  const drawRect: Rect2 = { x: margin.x, y: margin.y, w: screen.x, h: screen.y };
  if (scale.mode === ContentScaleMode.CANVAS_ITEMS) {
    const layoutSize = { x: storedReal(viewport.x / factor), y: storedReal(viewport.y / factor) };
    return { renderSize: screen, layoutSize, canvasScale: factor, drawRect };
  }
  if (scale.mode !== ContentScaleMode.VIEWPORT) return unknownModeScale(factor);
  // VIEWPORT: no 2D override, so the window lays out in its target (`viewport.cpp:1212-1214`).
  const renderSize = { x: Math.floor(viewport.x / factor), y: Math.floor(viewport.y / factor) };
  return { renderSize, layoutSize: renderSize, canvasScale: factor, drawRect };
}
