/**
 * The parallax scroll model — pure math, no THREE and no React, so every branch
 * is asserted directly instead of being inferred from a rendered frame.
 *
 * Godot drives it from the CURRENT Camera2D of the background's own viewport
 * (`ParallaxBackground::_notification` joins `"__cameras_" + viewport id`, the
 * group `Camera2D::_update_scroll` calls). `_camera_moved` takes the camera's
 * CANVAS transform and reads two numbers off it:
 *
 *     set_scroll_scale(p_transform.get_scale().dot(Vector2(0.5, 0.5)));
 *     set_scroll_offset(p_transform.get_origin());
 *
 * That transform is `Camera2D::get_camera_transform()`, which builds
 * `scale_basis(1/zoom)` + `set_origin(screen_rect.position)` and returns its
 * `affine_inverse()` — so its basis is `zoom` and its origin is
 * `-zoom * view_top_left`. Hence `scrollOffset = -zoom * topLeft`, and
 * `scrollScale` is that basis dotted with `(0.5, 0.5)`, i.e. the mean of the two
 * zoom axes. A single axis is read here instead, matching `camera2DView`, which
 * frames on `zoom.x` alone: no camera in the corpus has a non-uniform zoom, and
 * splitting the two readings would put the parallax on a different zoom from the
 * view it is anchored to.
 *
 * **With no current Camera2D nothing here runs at all.** `_update_scroll` and
 * `set_base_offset_and_scale` both early-return while the node is outside the
 * tree, and a `.tscn` applies every property before `add_child`, so a scene that
 * loads without a camera never repositions its layers: they keep the authored
 * `position`/`scale` and `scroll_base_offset` / `motion_scale` / `motion_offset`
 * are all inert. Measured through Godot 4.6.3 — a ParallaxBackground with
 * `scroll_base_offset = Vector2(0, 200)` and a layer at `motion_offset =
 * Vector2(300, 0)` drew both layers at the origin.
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
  /** `set_base_offset_and_scale`'s `p_scale` — a scalar, not a Vector2. */
  scale: number;
}

/** A ParallaxLayer's `motion_*` surface. */
export interface ParallaxLayerMotion {
  motion_scale: Vector2;
  motion_offset: Vector2;
  motion_mirroring: Vector2;
}

/**
 * The pose a ParallaxLayer is FORCED to, overwriting its authored one:
 * `set_position(new_ofs)` and `set_scale(Vector2(1, 1) * p_scale * orig_scale)`
 * both assign rather than compose, so `orig_offset` / `orig_scale` (the values
 * recorded on `NOTIFICATION_ENTER_TREE`) are inputs to the formula, never a
 * transform it stacks onto.
 */
export interface ParallaxLayerPose {
  /** Godot canvas pixels, relative to the ParallaxBackground's canvas. */
  position: Vector2;
  /** Uniform factor applied ON TOP of the layer's authored scale. */
  scale: number;
}

/**
 * Turn an orthographic view rect into the framing `parallaxScroll` needs.
 *
 * `left`/`right`/`top`/`bottom`/`x`/`y` describe the three.js camera (Y up);
 * the 2D world canvas negates Y (`node2dTransform`), so the Godot-space top edge
 * is the three-space `+Y` one. `cameraZoom` is the Camera2D's own magnification,
 * which is what separates "how many world pixels the view spans" (the frustum)
 * from "how many device pixels the viewport has" (frustum × zoom) — the
 * distinction `_update_scroll`'s limit clamp turns on.
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
 * `ParallaxBackground::_update_scroll()`, in its own order: build the scroll,
 * NEGATE it, clamp the negated value into the limits (which is why the limits
 * read as screen-space bounds rather than offsets), negate back.
 *
 * A limit pair only bites when `begin < end` on that axis — Godot's own guard,
 * and the reason the default `Vector2(0, 0)` / `Vector2(0, 0)` pair is inert.
 */
export function parallaxScroll(
  props: ParallaxScrollProperties,
  view: ParallaxViewFraming
): ParallaxScroll {
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

  // `l->set_base_offset_and_scale((scroll_ofs + screen_offset * (scale - 1)) / scale, 1.0)`.
  // `screen_offset` is `_camera_moved`'s third-from-last argument, which
  // `Camera2D::_update_scroll` builds as `screen_size * 0.5` — UNZOOMED, unlike
  // the `screen_size * 0.5 * zoom_scale` used twice inside
  // `get_camera_transform()`.
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
 * `ParallaxLayer::set_base_offset_and_scale()`:
 *
 *     Point2 new_ofs = p_offset * motion_scale + motion_offset * p_scale + orig_offset * p_scale;
 *     if (mirroring.x) { real_t den = mirroring.x * p_scale; new_ofs.x -= den * ceil(new_ofs.x / den); }
 *
 * The mirroring wrap pulls the layer into `(-den, 0]` so the pair of drawn
 * instances (see `parallaxMirrorOffsets`) straddles the view's left edge.
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
 * The scroll expressed as a DELTA on top of the layer's authored transform, so
 * the renderer can keep one `<Node2D>` carrying the authored pose (with its
 * modulate, z-index and skew handling intact) and wrap it in a group holding
 * only what the scroll changed.
 *
 * Godot's forced transform is `T(new_ofs) · R · Skew · S(p · orig_scale)` and the
 * authored one is `T(orig_offset) · R · Skew · S(orig_scale)`; `p` is a scalar so
 * it commutes with the rotation/shear, and the quotient collapses to
 * `T(new_ofs) · S(p) · T(-orig_offset)` — a translation and a uniform scale, with
 * the authored rotation and skew cancelling out exactly.
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
 * Where `motion_mirroring` repeats a layer, in the layer's OWN local space.
 *
 * `ParallaxLayer::_update_mirroring` hands the server
 * `mirror_scale = mirroring * orig_scale` through `canvas_set_item_mirroring`,
 * which sets `repeat_size = p_mirroring` with **`repeat_times = 1`** — so the
 * item is drawn twice per mirrored axis, at 0 and at `+repeat_size`, not tiled
 * across the view. `ParallaxLayer.xml` says the same thing in prose ("the
 * parallax layer only draws 2 instances of the layer at any given time"), and a
 * Godot 4.6.3 render of a layer mirrored every 100 px into a 1152 px viewport
 * put copies at x = 0 and x = 100 and nothing beyond.
 *
 * The offsets are returned with the un-mirrored copy LAST: it is the one whose
 * selection registration must win, and `registerNodeObject` keeps the last
 * writer for a path.
 */
export function parallaxMirrorOffsets(
  mirroring: Vector2,
  originScale: Vector2
): readonly Vector2[] {
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
