/**
 * The parallax scroll model, as pure math so every branch is tested directly.
 * Godot drives it from the current Camera2D of the background's own viewport
 * (the `"__cameras_" + viewport id` group). With none, nothing runs: the layers
 * keep their authored pose, and every scroll and motion key is inert.
 */

import type { Vector2 } from '../../base/node2d/types';

/** Stable empty result so an unmirrored layer never re-renders on identity. */
const EMPTY_MIRROR: readonly Vector2[] = [];

/** The canvas transform a viewport renders its 2D world through. */
export interface ParallaxViewFraming {
  /** The view rect's top-left corner, in Godot canvas pixels. */
  topLeft: Vector2;
  /** The viewport's own size in pixels (`_get_camera_screen_size()`). */
  size: Vector2;
  /** The current Camera2D's magnification (Godot `zoom`; higher = closer). */
  zoom: number;
  /** True for `ANCHOR_MODE_DRAG_CENTER`, Godot's default. */
  centered: boolean;
}

/** The `scroll_*` surface `_update_scroll` reads. */
export interface ParallaxScrollProperties {
  scroll_base_offset: Vector2;
  scroll_base_scale: Vector2;
  scroll_limit_begin: Vector2;
  scroll_limit_end: Vector2;
  scroll_ignore_camera_zoom: boolean;
}

/** What `_update_scroll` hands each `ParallaxLayer` child. */
export interface ParallaxScroll {
  /** `set_base_offset_and_scale`'s `p_offset`. */
  offset: Vector2;
  /** `set_base_offset_and_scale`'s `p_scale`: a scalar, not a Vector2. */
  scale: number;
}

/** A ParallaxLayer's `motion_*` surface. */
export interface ParallaxLayerMotion {
  motion_scale: Vector2;
  motion_offset: Vector2;
  motion_mirroring: Vector2;
}

/**
 * The pose a ParallaxLayer is forced to. `set_position` and `set_scale` assign,
 * not compose, so `orig_offset` and `orig_scale` (recorded on
 * `NOTIFICATION_ENTER_TREE`) are inputs to the formula, not a transform below it.
 */
export interface ParallaxLayerPose {
  /** Godot canvas pixels, relative to the ParallaxBackground's canvas. */
  position: Vector2;
  /** Uniform factor applied on top of the layer's authored scale. */
  scale: number;
}

/**
 * Turns a three.js orthographic view rect (Y up) into Godot framing: the canvas
 * negates Y, so the Godot top edge is three's `+Y` one. `cameraZoom` separates
 * the world span (the frustum) from the device pixels (frustum × zoom), which
 * `_update_scroll`'s limit clamp needs.
 */
export function parallaxViewFraming(
  rect: { left: number; right: number; top: number; bottom: number; x: number; y: number; zoom?: number },
  cameraZoom: number,
  centered: boolean
): ParallaxViewFraming {
  const z = rect.zoom || 1;
  const width = (rect.right - rect.left) / z;
  const height = (rect.top - rect.bottom) / z;
  const zoom = cameraZoom || 1;
  return {
    topLeft: { x: rect.x + rect.left / z, y: 0 - (rect.y + rect.top / z) },
    size: { x: width * zoom, y: height * zoom },
    zoom,
    centered,
  };
}

/**
 * `ParallaxBackground::_update_scroll()` in its own order: build the scroll,
 * negate it, clamp it into the limits (so they are screen-space bounds), negate
 * back. A limit pair applies only when `begin < end` on that axis, as in Godot.
 */
export function parallaxScroll(
  props: ParallaxScrollProperties,
  view: ParallaxViewFraming
): ParallaxScroll {
  // `_camera_moved` reads the inverse of `get_camera_transform()`: basis `zoom`,
  // origin `-zoom * view_top_left`. Godot's scroll scale is the mean of both zoom
  // axes. This reads one, as `camera2DView` frames on `zoom.x` alone, so the
  // parallax and the view it anchors to share one zoom.
  const scrollOffset = { x: 0 - view.zoom * view.topLeft.x, y: 0 - view.zoom * view.topLeft.y };
  const scale = view.zoom;

  let x = 0 - (props.scroll_base_offset.x + scrollOffset.x * props.scroll_base_scale.x);
  let y = 0 - (props.scroll_base_offset.y + scrollOffset.y * props.scroll_base_scale.y);

  const begin = props.scroll_limit_begin;
  const end = props.scroll_limit_end;
  if (begin.x < end.x) {
    if (x < begin.x) x = begin.x;
    else if (x + view.size.x > end.x) x = end.x - view.size.x;
  }
  if (begin.y < end.y) {
    if (y < begin.y) y = begin.y;
    else if (y + view.size.y > end.y) y = end.y - view.size.y;
  }

  const offset: Vector2 = { x: 0 - x, y: 0 - y };
  if (!props.scroll_ignore_camera_zoom) return { offset, scale };

  // `set_base_offset_and_scale((scroll_ofs + screen_offset * (scale - 1)) / scale, 1.0)`.
  // `Camera2D::_update_scroll` builds `screen_offset` as `screen_size * 0.5`:
  // unzoomed, unlike the `screen_size * 0.5 * zoom_scale` in `get_camera_transform()`.
  const screenX = view.centered ? view.size.x * 0.5 : 0;
  const screenY = view.centered ? view.size.y * 0.5 : 0;
  return {
    offset: {
      x: (offset.x + screenX * (scale - 1)) / scale,
      y: (offset.y + screenY * (scale - 1)) / scale,
    },
    scale: 1,
  };
}

/**
 * `ParallaxLayer::set_base_offset_and_scale()`: `p_offset * motion_scale` plus
 * `(motion_offset + orig_offset) * p_scale`. A mirrored axis then wraps into
 * `(-den, 0]`, `den = mirroring * p_scale`, so the two drawn instances straddle
 * the view's left edge.
 */
export function parallaxLayerPose(
  motion: ParallaxLayerMotion,
  origin: { position: Vector2 },
  scroll: ParallaxScroll
): ParallaxLayerPose {
  const p = scroll.scale;
  let x = scroll.offset.x * motion.motion_scale.x + motion.motion_offset.x * p + origin.position.x * p;
  let y = scroll.offset.y * motion.motion_scale.y + motion.motion_offset.y * p + origin.position.y * p;

  if (motion.motion_mirroring.x) {
    const den = motion.motion_mirroring.x * p;
    x -= den * Math.ceil(x / den);
  }
  if (motion.motion_mirroring.y) {
    const den = motion.motion_mirroring.y * p;
    y -= den * Math.ceil(y / den);
  }

  return { position: { x, y }, scale: p };
}

/**
 * The scroll as a delta on the layer's authored transform, so one `<Node2D>`
 * keeps the authored pose. The scalar `p` commutes with rotation and skew, so
 * the forced transform over the authored one is `T(new_ofs) · S(p) · T(-orig_offset)`.
 */
export function parallaxLayerDelta(
  pose: ParallaxLayerPose,
  origin: { position: Vector2 }
): { position: Vector2; scale: number } {
  return {
    position: {
      x: pose.position.x - pose.scale * origin.position.x,
      y: pose.position.y - pose.scale * origin.position.y,
    },
    scale: pose.scale,
  };
}

/**
 * Where `motion_mirroring` repeats a layer, in its own local space.
 * `canvas_set_item_mirroring` sets `repeat_times = 1`, so a mirrored axis draws
 * twice, at 0 and `+repeat_size`, not tiled (ParallaxLayer.xml agrees). The
 * unmirrored copy comes last: `registerNodeObject` keeps a path's last writer.
 */
export function parallaxMirrorOffsets(
  mirroring: Vector2,
  originScale: Vector2
): readonly Vector2[] {
  // `_update_mirroring` hands the server `mirroring * orig_scale`.
  const dx = mirroring.x * originScale.x;
  const dy = mirroring.y * originScale.y;
  if (!dx && !dy) return EMPTY_MIRROR;

  const repeats: Vector2[] = [];
  if (dx) repeats.push({ x: dx, y: 0 });
  if (dy) repeats.push({ x: 0, y: dy });
  if (dx && dy) repeats.push({ x: dx, y: dy });
  repeats.push({ x: 0, y: 0 });
  return repeats;
}
