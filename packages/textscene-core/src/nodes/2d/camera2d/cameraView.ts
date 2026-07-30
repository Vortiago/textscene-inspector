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

import { Camera2DAnchorMode, type Camera2DProperties } from './types';

export interface Camera2DView {
  /** View center in Godot canvas pixels. */
  center: { x: number; y: number };
  /** Magnification (Godot zoom; higher = closer). */
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
  const zoom = props.zoom.x || 1;
  const viewWidth = viewportSize.x / zoom;
  const viewHeight = viewportSize.y / zoom;

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
