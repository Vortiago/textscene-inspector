/**
 * The maths behind Godot's 3D editor viewport navigation, as pure functions.
 *
 * Godot does not steer the camera directly: `Node3DEditorViewport` keeps a
 * `Cursor { pos, x_rot, y_rot, distance }` — an orbit focus point plus the
 * pitch/yaw/radius of the eye around it — and rebuilds the camera transform
 * from it (`to_camera_transform`). Every navigation gesture is a small edit of
 * that cursor, which is why orbiting, panning, zooming and freelook compose
 * without drift and why the pole clamp can be a plain `CLAMP` on one scalar.
 *
 * This module mirrors that model. Cursors are immutable values, so each
 * gesture is `(cursor, deltas) -> cursor` and can be tested without a camera,
 * a canvas or a DOM. `<GodotEditorControls>` is the thin event wiring that
 * derives a cursor from the live camera, applies one of these, and writes the
 * result back.
 *
 * Constants are Godot's own (editor defaults from `editor_settings.cpp`,
 * hard-coded speeds from `node_3d_editor_plugin.cpp`) — never tuned by feel.
 */
import * as THREE from 'three';
import { clampWheelNotches, wheelNotches, type WheelEventLike } from './pointerGesture.js';

/** `editors/3d/navigation_feel/orbit_sensitivity`. */
export const ORBIT_DEGREES_PER_PIXEL = 0.25;

/** `editors/3d/freelook/freelook_sensitivity`. */
export const FREELOOK_DEGREES_PER_PIXEL = 0.25;

/**
 * `_nav_pan`: `translation_sensitivity / 150`, with the sensitivity editor
 * default of 1.0. Scaled by `distance / DISTANCE_DEFAULT` at use, so a pan
 * drags the scene under the pointer at roughly the same rate however far out
 * the eye has zoomed.
 */
export const PAN_PIXELS_TO_UNITS = 1 / 150;

/** `_nav_zoom`'s hard-coded `zoom_speed` for a drag-zoom. */
export const DRAG_ZOOM_SPEED = 1 / 80;

/** `ZOOM_FREELOOK_MULTIPLIER` — one wheel notch's distance scale. */
export const WHEEL_ZOOM_MULTIPLIER = 1.08;

/**
 * `_nav_orbit` clamps the pitch to "roughly -90..90 degrees so the user can't
 * look upside-down and end up disoriented" — deliberately just shy of a pole,
 * which is what keeps the derived basis non-degenerate mid-orbit.
 */
export const X_ROT_LIMIT = 1.57;

/** `editors/3d/freelook/freelook_base_speed`, in units per second. */
export const FREELOOK_BASE_SPEED = 5.0;

/** `_update_freelook`'s `freelook_speed_modifier` multiplier (Shift). */
export const FREELOOK_SPRINT_MULTIPLIER = 3.0;

/** `ZOOM_FREELOOK_MIN` / `ZOOM_FREELOOK_MAX` (single-precision editor build). */
export const ZOOM_DISTANCE_MIN = 0.01;
export const ZOOM_DISTANCE_MAX = 10000;

/** `DISTANCE_DEFAULT` — the reference radius pan speed is scaled against. */
const DISTANCE_DEFAULT = 4;

/** Below this radius the eye sits on the focus point and has no direction. */
const DEGENERATE_DISTANCE = 1e-6;

/**
 * Godot's `Cursor`: where the eye orbits (`target`), the pitch (`xRot`) and
 * yaw (`yRot`) of the eye about it, and how far out it sits (`distance`).
 * Immutable — every gesture returns a fresh cursor.
 */
export interface EditorCursor {
  readonly target: THREE.Vector3;
  readonly xRot: number;
  readonly yRot: number;
  readonly distance: number;
}

/** Near/far of the live camera — Godot derives its zoom range from them. */
export interface ZoomRange {
  near: number;
  far: number;
}

/** Which of the six axis-aligned faces a view snap looks at the scene from. */
export type GodotViewAngle = 'front' | 'rear' | 'left' | 'right' | 'top' | 'bottom';

/**
 * `_menu_option`'s VIEW_TOP/BOTTOM/LEFT/RIGHT/FRONT/REAR cursor angles. A snap
 * sets the two rotations outright and leaves the focus point and radius alone,
 * so it re-frames the same content from a different face.
 */
export const VIEW_ANGLES: Readonly<Record<GodotViewAngle, { xRot: number; yRot: number }>> = {
  front: { xRot: 0, yRot: 0 },
  rear: { xRot: 0, yRot: Math.PI },
  left: { xRot: 0, yRot: Math.PI / 2 },
  right: { xRot: 0, yRot: -Math.PI / 2 },
  top: { xRot: Math.PI / 2, yRot: 0 },
  bottom: { xRot: -Math.PI / 2, yRot: 0 },
};

/** The face opposite each view — Godot's Ctrl+Numpad variants. */
export const OPPOSITE_VIEW: Readonly<Record<GodotViewAngle, GodotViewAngle>> = {
  front: 'rear',
  rear: 'front',
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

/** What a drag is currently doing, from its button and the held modifiers. */
export type NavMode = 'orbit' | 'pan' | 'zoom' | 'freelook';

/** The modifier state a nav mode depends on. */
export interface NavModifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * Godot's button/modifier map, plus its "Emulate 3 Button Mouse" alt+left
 * bindings unconditionally. Returns null for a drag navigation must leave
 * alone — notably plain left-drag, which selects.
 *
 * Callers re-evaluate this on every pointer move rather than latching it at
 * pointer-down, because Godot re-reads the modifiers per motion event:
 * pressing Shift mid-drag turns an orbit into a pan.
 */
export function resolveNavMode(button: number, mods: NavModifiers): NavMode | null {
  if (button === 1) return mods.ctrlKey ? 'zoom' : mods.shiftKey ? 'pan' : 'orbit';
  if (button === 2) return 'freelook';
  if (button === 0 && mods.altKey) return mods.shiftKey ? 'pan' : 'orbit';
  return null;
}

/** Which keys freelook movement is currently holding down. */
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
 * The cursor's camera basis: `to_camera_transform` rotates about X by `-xRot`
 * and then about Y by `-yRot`. Built as a quaternion rather than via
 * `Object3D.lookAt` because lookAt is undefined when the view direction is
 * parallel to the up vector — exactly the top/bottom view snaps.
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
 * Recover a cursor from a live camera position and focus point — the inverse
 * of `cursorCameraPosition`.
 *
 * Every gesture starts here rather than from cached rotations, so a camera
 * moved from OUTSIDE this module (`frameSceneBounds` on F-to-frame and on
 * load-time auto-fit writes both the position and the target) is picked up
 * instead of being snapped back to a stale pose on the next drag.
 *
 * A degenerate offset (eye on the focus point) has no direction; it yields the
 * zero rotations, which callers treat as "leave the orientation alone".
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
 * `_nav_orbit` — the eye swings around the focus point. Pitch accumulates with
 * vertical motion and is clamped at the poles; yaw accumulates freely (Godot
 * never wraps or clamps it, so a full turn keeps working).
 */
export function orbitCursor(cursor: EditorCursor, dx: number, dy: number): EditorCursor {
  const radiansPerPixel = degreesToRadians(ORBIT_DEGREES_PER_PIXEL);
  return {
    ...cursor,
    xRot: clampPitch(cursor.xRot + dy * radiansPerPixel),
    yRot: cursor.yRot + dx * radiansPerPixel,
  };
}

/**
 * `_nav_pan` — the focus point slides in the camera's own screen plane, so the
 * eye follows it and the view direction never changes. Speed scales with the
 * orbit radius.
 */
export function panCursor(cursor: EditorCursor, dx: number, dy: number): EditorCursor {
  const speed = (PAN_PIXELS_TO_UNITS * cursor.distance) / DISTANCE_DEFAULT;
  const translation = new THREE.Vector3(-dx * speed, dy * speed, 0).applyQuaternion(
    cursorQuaternion(cursor)
  );
  return { ...cursor, target: cursor.target.clone().add(translation) };
}

/**
 * `scale_cursor_distance` — the radius is multiplied, never added to, so zoom
 * decelerates as it approaches the focus point and can never cross it. The
 * range is derived from the camera's own clip planes exactly as Godot does.
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
 * `_nav_zoom` with the default vertical zoom style: dragging down pushes the
 * eye out, dragging up pulls it in, and the two directions are exact inverses
 * of each other so a drag that returns to where it started restores the radius.
 */
export function dollyCursor(cursor: EditorCursor, dy: number, range: ZoomRange): EditorCursor {
  if (dy === 0) return cursor;
  const scale = dy > 0 ? 1 + dy * DRAG_ZOOM_SPEED : 1 / (1 - dy * DRAG_ZOOM_SPEED);
  return scaleCursorDistance(cursor, scale, range);
}

/**
 * The distance scale for one wheel event. Godot applies its multiplier PER
 * NOTCH, so the scale is exponential in notches rather than linear in them —
 * which is what makes it composable: a trackpad's stream of sixteen small
 * events zooms exactly as far as one big event covering the same distance,
 * instead of slightly further. The browser-side normalisation and the
 * per-event cap live in `pointerGesture.ts`; only the multiplier is Godot's.
 */
export function wheelZoomScale(event: WheelEventLike): number {
  const notches = clampWheelNotches(wheelNotches(event));
  if (notches === 0) return 1;
  return WHEEL_ZOOM_MULTIPLIER ** notches;
}

/**
 * Which navigation a wheel event drives. Godot has TWO bindings for what the
 * browser collapses into one event: `WHEEL_UP`/`WHEEL_DOWN` zooms
 * unconditionally, while `InputEventPanGesture` (a trackpad two-finger scroll)
 * resolves by modifier — pan on Shift, zoom on Ctrl. The mouse-wheel binding
 * takes the unmodified slot, since a browser cannot tell the two devices
 * apart and a mouse wheel must not orbit; the gesture bindings take the
 * modified ones.
 *
 * Ctrl lands on zoom from both directions: it is Godot's zoom modifier AND how
 * every browser reports a trackpad pinch.
 */
export function resolveWheelMode(mods: NavModifiers): 'pan' | 'zoom' {
  return mods.shiftKey && !mods.ctrlKey ? 'pan' : 'zoom';
}

/**
 * `_nav_look` — freelook is the inverse of orbit: the eye stays put and the
 * focus point swings around IT. Godot implements that by rotating the cursor
 * and then translating the focus point by however far the eye would have
 * moved, which is what this reproduces.
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
 * `_update_freelook` under the default (fully camera-relative) scheme: W/S run
 * along the view direction including its pitch, A/D along the camera's right,
 * Q/E along the camera's up. Moving the focus point moves the eye with it,
 * since the radius and rotations are untouched.
 *
 * The direction is a SUM of unit axes and is deliberately not normalised —
 * Godot's diagonals are faster, and matching that is the point.
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
 * `_update_camera`'s orthogonal frustum height: `2 * distance * tan(fov / 2)`,
 * i.e. the height the perspective camera would see AT the focus point. Zooming
 * therefore keeps working in orthographic mode, where moving the eye alone
 * would change nothing on screen.
 */
export function orthographicHeight(distance: number, fovDegrees: number): number {
  return 2 * distance * Math.tan(degreesToRadians(fovDegrees) / 2);
}
