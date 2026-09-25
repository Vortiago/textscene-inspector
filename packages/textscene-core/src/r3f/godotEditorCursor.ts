/**
 * Godot's 3D editor navigation as pure `(cursor, deltas) -> cursor` functions. The
 * `Node3DEditorViewport` cursor is a focus point plus the eye's pitch, yaw and radius about it,
 * and `to_camera_transform` rebuilds the camera from it, so gestures compose without drift.
 * Constants are `editor_settings.cpp` defaults and `node_3d_editor_plugin.cpp` speeds.
 */
import * as THREE from 'three';
import { clampWheelNotches, wheelNotches, type WheelEventLike } from './pointerGesture.js';

/** `editors/3d/navigation_feel/orbit_sensitivity`. */
export const ORBIT_DEGREES_PER_PIXEL = 0.25;

/** `editors/3d/freelook/freelook_sensitivity`. */
export const FREELOOK_DEGREES_PER_PIXEL = 0.25;

/**
 * `_nav_pan`: `translation_sensitivity / 150`, at the editor default sensitivity of 1.0. Scaled
 * by `distance / DISTANCE_DEFAULT` at use, so a pan moves at about one rate at any zoom.
 */
export const PAN_PIXELS_TO_UNITS = 1 / 150;

/** `_nav_zoom`'s hard-coded `zoom_speed` for a drag-zoom. */
export const DRAG_ZOOM_SPEED = 1 / 80;

/** `ZOOM_FREELOOK_MULTIPLIER`: one wheel notch's distance scale. */
export const WHEEL_ZOOM_MULTIPLIER = 1.08;

/**
 * `_nav_orbit` clamps the pitch to just short of ±90 degrees, which keeps the derived basis
 * non-degenerate mid-orbit.
 */
export const X_ROT_LIMIT = 1.57;

/** `editors/3d/freelook/freelook_base_speed`, in units per second. */
export const FREELOOK_BASE_SPEED = 5.0;

/** `_update_freelook`'s `freelook_speed_modifier` multiplier (Shift). */
export const FREELOOK_SPRINT_MULTIPLIER = 3.0;

/** `ZOOM_FREELOOK_MIN` / `ZOOM_FREELOOK_MAX` (single-precision editor build). */
export const ZOOM_DISTANCE_MIN = 0.01;
export const ZOOM_DISTANCE_MAX = 10000;

/** `DISTANCE_DEFAULT`: the reference radius pan speed is scaled against. */
const DISTANCE_DEFAULT = 4;

/** Below this radius the eye sits on the focus point and has no direction. */
export const DEGENERATE_DISTANCE = 1e-6;

/** Godot's `Cursor`, immutable: every gesture returns a fresh one. */
export interface EditorCursor {
  readonly target: THREE.Vector3;
  readonly xRot: number;
  readonly yRot: number;
  readonly distance: number;
}

/** Near and far of the live camera, from which Godot derives its zoom range. */
export interface ZoomRange {
  near: number;
  far: number;
}

/** Which of the six axis-aligned faces a view snap looks at the scene from. */
export type GodotViewAngle = 'front' | 'rear' | 'left' | 'right' | 'top' | 'bottom';

/**
 * `_menu_option`'s VIEW_TOP/BOTTOM/LEFT/RIGHT/FRONT/REAR cursor angles. A snap sets the two
 * rotations and leaves the focus point and radius alone.
 */
export const VIEW_ANGLES: Readonly<Record<GodotViewAngle, { xRot: number; yRot: number }>> = {
  front: { xRot: 0, yRot: 0 },
  rear: { xRot: 0, yRot: Math.PI },
  left: { xRot: 0, yRot: Math.PI / 2 },
  right: { xRot: 0, yRot: -Math.PI / 2 },
  top: { xRot: Math.PI / 2, yRot: 0 },
  bottom: { xRot: -Math.PI / 2, yRot: 0 },
};

/** The face opposite each view: Godot's Ctrl+Numpad variants. */
export const OPPOSITE_VIEW: Readonly<Record<GodotViewAngle, GodotViewAngle>> = {
  front: 'rear',
  rear: 'front',
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

export type NavMode = 'orbit' | 'pan' | 'zoom' | 'freelook';

export interface NavModifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * Godot's button and modifier map, plus its "Emulate 3 Button Mouse" alt+left bindings always.
 * Null means navigation leaves the drag alone, as for a plain left-drag, which selects. Call it
 * on every pointer move: Godot re-reads the modifiers per motion event, so Shift mid-drag turns
 * an orbit into a pan.
 */
export function resolveNavMode(button: number, mods: NavModifiers): NavMode | null {
  if (button === 1) return mods.ctrlKey ? 'zoom' : mods.shiftKey ? 'pan' : 'orbit';
  if (button === 2) return 'freelook';
  if (button === 0 && mods.altKey) return mods.shiftKey ? 'pan' : 'orbit';
  return null;
}

export interface FreelookKeys {
  forward?: boolean;
  back?: boolean;
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
  sprint?: boolean;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clampPitch(xRot: number): number {
  return THREE.MathUtils.clamp(xRot, -X_ROT_LIMIT, X_ROT_LIMIT);
}

/**
 * `to_camera_transform` rotates about X by `-xRot`, then about Y by `-yRot`. A quaternion, not
 * `Object3D.lookAt`: lookAt is undefined when the view is parallel to up, as in the top and
 * bottom view snaps.
 */
export function cursorQuaternion(cursor: EditorCursor): THREE.Quaternion {
  return new THREE.Quaternion()
    .setFromAxisAngle(AXIS_Y, -cursor.yRot)
    .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, -cursor.xRot));
}

/** The unit vector from the focus point towards the eye. */
export function cursorDirection(cursor: EditorCursor): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1)
    .applyAxisAngle(AXIS_X, -cursor.xRot)
    .applyAxisAngle(AXIS_Y, -cursor.yRot);
}

/** Where `to_camera_transform` puts the eye for this cursor. */
export function cursorCameraPosition(cursor: EditorCursor): THREE.Vector3 {
  return cursorDirection(cursor).multiplyScalar(cursor.distance).add(cursor.target);
}

/**
 * The inverse of `cursorCameraPosition`. Every gesture starts here, not from cached rotations,
 * so a camera that `frameSceneBounds` moved is not snapped back to a stale pose on the next drag.
 * An eye on the focus point has no direction and yields zero rotations, which callers read as
 * "leave the orientation alone".
 */
export function cursorFromCamera(position: THREE.Vector3, target: THREE.Vector3): EditorCursor {
  const offset = position.clone().sub(target);
  const distance = offset.length();
  if (distance < DEGENERATE_DISTANCE) {
    return { target: target.clone(), xRot: 0, yRot: 0, distance: 0 };
  }
  const dir = offset.divideScalar(distance);
  return {
    target: target.clone(),
    xRot: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
    yRot: Math.atan2(-dir.x, dir.z),
    distance,
  };
}

/**
 * `_nav_orbit`: the eye swings around the focus point. Pitch is clamped at the poles. Yaw
 * accumulates without a wrap or a clamp, as in Godot.
 */
export function orbitCursor(cursor: EditorCursor, dx: number, dy: number): EditorCursor {
  const radiansPerPixel = degreesToRadians(ORBIT_DEGREES_PER_PIXEL);
  return {
    ...cursor,
    xRot: clampPitch(cursor.xRot + dy * radiansPerPixel),
    yRot: cursor.yRot + dx * radiansPerPixel,
  };
}

/** `_nav_pan`: the focus point slides in the screen plane, at a speed that scales with the radius. */
export function panCursor(cursor: EditorCursor, dx: number, dy: number): EditorCursor {
  const speed = (PAN_PIXELS_TO_UNITS * cursor.distance) / DISTANCE_DEFAULT;
  return slideCursorInViewPlane(cursor, -dx * speed, dy * speed);
}

/**
 * Slides the focus point in the screen plane, in world units: `+right` moves it right on screen,
 * `+up` moves it up. Pan and zoom-to-pointer share it, so the two cannot disagree about which
 * way screen-y runs.
 */
export function slideCursorInViewPlane(
  cursor: EditorCursor,
  right: number,
  up: number
): EditorCursor {
  const translation = new THREE.Vector3(right, up, 0).applyQuaternion(cursorQuaternion(cursor));
  return { ...cursor, target: cursor.target.clone().add(translation) };
}

/**
 * `scale_cursor_distance`: the radius is multiplied, never added to, so zoom slows near the focus
 * point and never crosses it. The range comes from the camera's clip planes, as in Godot.
 */
export function scaleCursorDistance(
  cursor: EditorCursor,
  scale: number,
  range: ZoomRange
): EditorCursor {
  const min = Math.max(range.near * 4, ZOOM_DISTANCE_MIN);
  const max = Math.min(range.far / 4, ZOOM_DISTANCE_MAX);
  const distance =
    min > max ? (min + max) / 2 : THREE.MathUtils.clamp(cursor.distance * scale, min, max);
  return { ...cursor, distance };
}

/**
 * `_nav_zoom`, vertical style: dragging down pushes the eye out, up pulls it in. The two are
 * exact inverses, so a drag back to its start restores the radius.
 */
export function dollyCursor(cursor: EditorCursor, dy: number, range: ZoomRange): EditorCursor {
  if (dy === 0) return cursor;
  const scale = dy > 0 ? 1 + dy * DRAG_ZOOM_SPEED : 1 / (1 - dy * DRAG_ZOOM_SPEED);
  return scaleCursorDistance(cursor, scale, range);
}

/**
 * Godot applies its multiplier per notch, so the scale is exponential in notches: sixteen small
 * trackpad events zoom exactly as far as one big event over the same distance. The browser
 * normalisation and the per-event cap live in `pointerGesture.ts`.
 */
export function wheelZoomScale(event: WheelEventLike): number {
  const notches = clampWheelNotches(wheelNotches(event));
  if (notches === 0) return 1;
  return WHEEL_ZOOM_MULTIPLIER ** notches;
}

/**
 * The browser merges two Godot bindings: `WHEEL_UP`/`WHEEL_DOWN` always zooms, and
 * `InputEventPanGesture` pans on Shift and zooms on Ctrl. The wheel takes the unmodified slot,
 * since the browser cannot tell the devices apart. Ctrl zooms both as Godot's zoom modifier and
 * as the browser's trackpad pinch.
 */
export function resolveWheelMode(mods: NavModifiers): 'pan' | 'zoom' {
  return mods.shiftKey && !mods.ctrlKey ? 'pan' : 'zoom';
}

/**
 * `_nav_look`: the eye stays put and the focus point swings around it. Godot rotates the cursor,
 * then moves the focus point by how far the eye would have moved.
 */
export function freelookCursor(cursor: EditorCursor, dx: number, dy: number): EditorCursor {
  const radiansPerPixel = degreesToRadians(FREELOOK_DEGREES_PER_PIXEL);
  const rotated: EditorCursor = {
    ...cursor,
    xRot: clampPitch(cursor.xRot + dy * radiansPerPixel),
    yRot: cursor.yRot + dx * radiansPerPixel,
  };
  const eyeDrift = cursorCameraPosition(cursor).sub(cursorCameraPosition(rotated));
  return { ...rotated, target: rotated.target.clone().add(eyeDrift) };
}

/**
 * `_update_freelook`, camera-relative scheme: W/S run along the view direction with its pitch,
 * A/D along the camera's right, Q/E along its up. The direction is a sum of unit axes and not
 * normalised, since Godot's diagonals are faster.
 */
export function freelookMoveCursor(
  cursor: EditorCursor,
  keys: FreelookKeys,
  deltaSeconds: number
): EditorCursor {
  const basis = cursorQuaternion(cursor);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(basis);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(basis);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(basis);

  const direction = new THREE.Vector3();
  if (keys.forward) direction.add(forward);
  if (keys.back) direction.sub(forward);
  if (keys.right) direction.add(right);
  if (keys.left) direction.sub(right);
  if (keys.up) direction.add(up);
  if (keys.down) direction.sub(up);
  if (direction.lengthSq() === 0) return cursor;

  const speed = FREELOOK_BASE_SPEED * (keys.sprint ? FREELOOK_SPRINT_MULTIPLIER : 1);
  const motion = direction.multiplyScalar(speed * deltaSeconds);
  return { ...cursor, target: cursor.target.clone().add(motion) };
}

/** Point the eye at one of the six axis-aligned faces, keeping focus and radius. */
export function viewSnapCursor(cursor: EditorCursor, view: GodotViewAngle): EditorCursor {
  return { ...cursor, ...VIEW_ANGLES[view] };
}

/**
 * `_update_camera`'s orthogonal frustum height: what the perspective camera sees at the focus
 * point. Zoom therefore works in orthographic mode, where moving the eye changes nothing.
 */
export function orthographicHeight(distance: number, fovDegrees: number): number {
  return 2 * distance * Math.tan(degreesToRadians(fovDegrees) / 2);
}
