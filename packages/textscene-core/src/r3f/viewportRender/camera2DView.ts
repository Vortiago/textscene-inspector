/**
 * What a Camera2D frames, after `camera_2d.cpp::get_camera_transform()`: pure math
 * from its parsed properties and world position to the view centre in Godot canvas
 * pixels and the magnification. DRAG_CENTER centres the view on the camera, and
 * FIXED_TOP_LEFT puts the camera at its corner.
 */
import { isZeroApprox } from '../../godot/math/math.js';
import type { Camera2DProperties } from '../../nodes/2d/camera2d/types';
import { Camera2DAnchorMode } from '../../godot/scene/camera2d.js';

interface Camera2DView {
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
  /** The angle the view turns by, in radians clockwise on screen: 0 while `ignore_rotation` is on. */
  rotation: number;
}

/** Where a Camera2D stands in its canvas: the position, and the global rotation where one is read. */
export interface Camera2DPlacement {
  x: number;
  y: number;
  rotation?: number;
}

/**
 * Everything `camera2DView` needs, and what `<Camera2D>` publishes on
 * `userData.camera2d`. The position is absent: a consumer reads it from where it
 * holds the camera, the live tree or an Object3D's world matrix.
 */
type Camera2DFraming = Pick<
  Camera2DProperties,
  | 'zoom'
  | 'offset'
  | 'anchor_mode'
  | 'limitLeft'
  | 'limitTop'
  | 'limitRight'
  | 'limitBottom'
  | 'limitEnabled'
  | 'ignoreRotation'
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
  placement: Camera2DPlacement,
  viewportSize: { x: number; y: number }
): Camera2DView {
  // `set_zoom` refuses the whole write when either component is zero-approx
  // (camera_2d.cpp:104), so (1, 1) stays on both axes: `Vector2(0, 2)` frames at
  // (1, 1), as the validator reads it. The rect is `screen_size * zoom_scale`, per
  // axis (camera_2d.cpp:107, :163).
  const refused = isZeroApprox(props.zoom.x) || isZeroApprox(props.zoom.y);
  const zoom = refused ? 1 : props.zoom.x;
  const zoomY = refused ? 1 : props.zoom.y;
  const half = { x: viewportSize.x / zoom / 2, y: viewportSize.y / zoomY / 2 };
  const rotation = props.ignoreRotation === false ? (placement.rotation ?? 0) : 0;

  // camera_2d.cpp:212-224: the anchor's offset turns with the view, and the rect starts there.
  const anchor =
    props.anchor_mode === Camera2DAnchorMode.FIXED_TOP_LEFT ? { x: 0, y: 0 } : turned(half, rotation);
  let left = placement.x - anchor.x;
  let top = placement.y - anchor.y;

  // Godot clamps the corner before it adds `offset`, over twice the turned anchor offset.
  if (props.limitEnabled !== false) {
    left = clampToLimits(left, 2 * anchor.x, props.limitLeft, props.limitRight);
    top = clampToLimits(top, 2 * anchor.y, props.limitTop, props.limitBottom);
  }

  // `camera_screen_center`: the corner, then half the screen turned with the view (camera_2d.cpp:259).
  const toCentre = turned(half, rotation);
  return {
    center: { x: left + props.offset.x + toCentre.x, y: top + props.offset.y + toCentre.y },
    size: { x: half.x * 2, y: half.y * 2 },
    zoom,
    rotation,
  };
}

/** `Vector2::rotated`, in Godot's canvas pixels with +Y down. */
function turned(vector: { x: number; y: number }, angle: number): { x: number; y: number } {
  if (angle === 0) return vector;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
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
