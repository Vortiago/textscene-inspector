/**
 * The geometry of a Control clip: a node-local rect placed on the canvas, rounded as Godot rounds
 * its scissor, and turned into "keep inside" clip planes. See `controlClipping.md`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import * as THREE from 'three';
import { round as godotRound } from '../../../godot/math/math';
import type { Rect2 } from '../../../godot/math/rect2';

/**
 * Appends a node's own planes to the inherited ones, which only narrows. With no
 * own planes it returns `inherited` itself, so a Provider re-renders no consumer.
 * Only the unquantized path accumulates: with a rect, the result is 4 planes.
 */
export function withAdditionalClipPlanes(
  inherited: readonly THREE.Plane[],
  own: readonly THREE.Plane[]
): readonly THREE.Plane[] {
  return own.length === 0 ? inherited : [...inherited, ...own];
}

/**
 * The 4 "keep inside" planes for a +Y-down `rect`, negating Y here (`rect.ts`).
 * `clippingPlanes` test the fragment's world position, so planes from a
 * node-local rect need the group's `matrixWorld`. Planes from the absolute
 * canvas rect are already world planes.
 */
export function localRectClipPlanes(rect: Rect2): THREE.Plane[] {
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = -rect.y;
  const bottom = -(rect.y + rect.h);
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -left), // keep x >= left
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), right), // keep x <= right
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -bottom), // keep y >= bottom
    new THREE.Plane(new THREE.Vector3(0, -1, 0), top), // keep y <= top
  ];
}

/**
 * How far a basis vector may lean off its axis and still count as axis-aligned.
 * Three writes exact zeros for a zero-rotation Euler, so this absorbs
 * composition slack, not a near-miss angle.
 */
const AXIS_ALIGNMENT_EPSILON = 1e-6;

/**
 * A node-local `rect` as an absolute canvas rect, or null when `matrixWorld`
 * rotates and the caller must use rotated planes. Like `Transform2D::xform(Rect2)`,
 * a negative scale flips an edge and the result is the corner-wise extent.
 */
export function worldClipRect(rect: Rect2, matrixWorld: THREE.Matrix4): Rect2 | null {
  const e = matrixWorld.elements;
  // Column-major: e[1] is the X basis's Y component, e[4] the Y basis's X one.
  if (Math.abs(e[1]!) > AXIS_ALIGNMENT_EPSILON || Math.abs(e[4]!) > AXIS_ALIGNMENT_EPSILON) {
    return null;
  }
  const topLeft = new THREE.Vector3(rect.x, -rect.y, 0).applyMatrix4(matrixWorld);
  const bottomRight = new THREE.Vector3(rect.x + rect.w, -(rect.y + rect.h), 0).applyMatrix4(matrixWorld);
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: -Math.max(topLeft.y, bottomRight.y),
    w: Math.abs(bottomRight.x - topLeft.x),
    h: Math.abs(topLeft.y - bottomRight.y),
  };
}

/**
 * Godot's whole-pixel clip rect (`renderer_canvas_cull.cpp:422-423`): position and
 * size round independently, so the far edge is `round(position) + round(size)`.
 */
export function quantizeClipRect(rect: Rect2): Rect2 {
  return {
    x: godotRound(rect.x),
    y: godotRound(rect.y),
    w: godotRound(rect.w),
    h: godotRound(rect.h),
  };
}
