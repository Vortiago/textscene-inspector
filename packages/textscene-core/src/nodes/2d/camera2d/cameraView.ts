/**
 * What a Camera2D frames — pure math from the camera's parsed surface + its
 * world position to {view center (Godot canvas px), magnification}. Mirrors
 * Godot's anchoring: DRAG_CENTER (default) centers the view on the camera;
 * FIXED_TOP_LEFT puts the camera at the view's top-left corner, so the
 * center sits half a view further (view size = viewport / zoom). Consumed by
 * the Cameras panel to frame the 2D stage ("view through" a 2D camera).
 *
 * Order matters and matches `camera_2d.cpp::get_camera_transform()`: the view
 * rect is clamped into the scroll limits FIRST and `offset` is added AFTER —
 * which is why the class reference says "the offsetted camera can go past the
 * limits".
 */

import { isZeroApprox } from '../../../godot/index.js';
import { Camera2DAnchorMode, type Camera2DProperties } from './types';

export interface Camera2DView {
  /** View center in Godot canvas pixels. */
  center: { x: number; y: number };
  /**
   * The framed extent in Godot canvas pixels, PER AXIS.
   *
   * `zoom_scale` is `Vector2(1, 1) / zoom` and the rect is `screen_size *
   * zoom_scale` (camera_2d.cpp:107, :163), so a non-uniform zoom frames a
   * different width and height. Returned rather than left to each consumer to
   * re-derive: dividing the viewport by a single magnification is exactly the
   * mistake this replaces.
   */
  size: { x: number; y: number };
  /**
   * Magnification on the X axis, for a consumer that can only hold one — the
   * "look through this camera" control frames an orbit camera and has no second
   * axis to give. Anything framing a RECT wants {@link Camera2DView.size}.
   */
  zoom: number;
}

/**
 * Everything `camera2DView` needs, and exactly what `<Camera2D>` publishes on
 * `userData.camera2d` — the parsed framing surface, with the node's own
 * position deliberately absent because a consumer resolves that from wherever
 * it holds the camera (the live tree, or an Object3D's world matrix).
 */
export type Camera2DFraming = Pick<
  Camera2DProperties,
  | 'zoom'
  | 'offset'
  | 'anchor_mode'
  | 'limitLeft'
  | 'limitTop'
  | 'limitRight'
  | 'limitBottom'
  | 'limitEnabled'
>;

/**
 * The `userData.camera2d` payload `<Camera2D>` publishes: the framing surface
 * plus `enabled`, which decides whether the camera is eligible to become its
 * viewport's current one.
 */
export interface Camera2DTag extends Camera2DFraming {
  enabled: boolean;
}

export function camera2DView(
  props: Camera2DFraming,
  worldPosition: { x: number; y: number },
  viewportSize: { x: number; y: number }
): Camera2DView {
  // `set_zoom` refuses the WHOLE write when either component is zero-approx
  // (`ERR_FAIL_COND_MSG(Math::is_zero_approx(p_zoom.x) ||
  // Math::is_zero_approx(p_zoom.y), …)`, camera_2d.cpp:104), so the default
  // (1, 1) stays on both axes — `Vector2(0, 2)` frames at (1, 1), not (1, 2).
  // The slice's own validator reads it the same way (linterParser.ts:45).
  // Framing is then per axis: `zoom_scale = Vector2(1, 1) / zoom` and the rect
  // is `screen_size * zoom_scale` (camera_2d.cpp:107, :163).
  const refused = isZeroApprox(props.zoom.x) || isZeroApprox(props.zoom.y);
  const zoom = refused ? 1 : props.zoom.x;
  const zoomY = refused ? 1 : props.zoom.y;
  const viewWidth = viewportSize.x / zoom;
  const viewHeight = viewportSize.y / zoomY;

  // Godot clamps the view RECT, so work in top-left space and convert back.
  let left = worldPosition.x;
  let top = worldPosition.y;
  if (props.anchor_mode !== Camera2DAnchorMode.FIXED_TOP_LEFT) {
    left -= viewWidth / 2;
    top -= viewHeight / 2;
  }

  if (props.limitEnabled !== false) {
    left = clampToLimits(left, viewWidth, props.limitLeft, props.limitRight);
    top = clampToLimits(top, viewHeight, props.limitTop, props.limitBottom);
  }

  return {
    center: {
      x: left + viewWidth / 2 + props.offset.x,
      y: top + viewHeight / 2 + props.offset.y,
    },
    size: { x: viewWidth, y: viewHeight },
    zoom,
  };
}

/**
 * One axis of Godot's limit clamp, in the engine's own branch order.
 *
 * The first branch is the one that is easy to miss: when the view is WIDER than
 * the span between the limits, Godot centres it in the span rather than pinning
 * it to either edge.
 */
function clampToLimits(position: number, extent: number, near: number, far: number): number {
  if (near > far - extent) return (near + far - extent) / 2;
  if (position < near) return near;
  if (position + extent > far) return far - extent;
  return position;
}
