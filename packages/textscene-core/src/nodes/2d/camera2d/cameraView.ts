/**
 * What a Camera2D frames, after `camera_2d.cpp::get_camera_transform()`: pure math
 * from its parsed properties and world position to the view centre in Godot canvas
 * pixels and the magnification. DRAG_CENTER centres the view on the camera, and
 * FIXED_TOP_LEFT puts the camera at its corner.
 */

import { isZeroApprox } from '../../../godot/index.js';
import { Camera2DAnchorMode, type Camera2DProperties } from './types';

export interface Camera2DView {
  /** View center in Godot canvas pixels. */
  center: { x: number; y: number };
  /**
   * The framed extent in Godot canvas pixels, per axis: `zoom_scale` is
   * `Vector2(1, 1) / zoom` and the rect is `screen_size * zoom_scale`
   * (camera_2d.cpp:107, :163). A consumer that divides by one magnification is wrong.
   */
  size: { x: number; y: number };
  /**
   * Magnification on the X axis, for a consumer that holds one, such as the "look
   * through this camera" control. Anything framing a rect wants
   * {@link Camera2DView.size}.
   */
  zoom: number;
}

/**
 * Everything `camera2DView` needs, and what `<Camera2D>` publishes on
 * `userData.camera2d`. The position is absent: a consumer reads it from where it
 * holds the camera, the live tree or an Object3D's world matrix.
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
  // `set_zoom` refuses the whole write when either component is zero-approx
  // (camera_2d.cpp:104), so (1, 1) stays on both axes: `Vector2(0, 2)` frames at
  // (1, 1), as the validator reads it. The rect is `screen_size * zoom_scale`, per
  // axis (camera_2d.cpp:107, :163).
  const refused = isZeroApprox(props.zoom.x) || isZeroApprox(props.zoom.y);
  const zoom = refused ? 1 : props.zoom.x;
  const zoomY = refused ? 1 : props.zoom.y;
  const viewWidth = viewportSize.x / zoom;
  const viewHeight = viewportSize.y / zoomY;

  // Godot clamps the view rect before it adds `offset`, so work in top-left space
  // and convert back. The offset camera can go past the limits.
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
 * One axis of Godot's limit clamp, in the engine's branch order. A view wider than
 * the span between the limits centres in the span, pinned to neither edge.
 */
function clampToLimits(position: number, extent: number, near: number, far: number): number {
  if (near > far - extent) return (near + far - extent) / 2;
  if (position < near) return near;
  if (position + extent > far) return far - extent;
  return position;
}
