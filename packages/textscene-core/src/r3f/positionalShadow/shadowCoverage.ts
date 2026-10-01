/**
 * How much of the screen an omni or spot light's range covers, as Godot measures it to choose the
 * light's shadow slot (`servers/rendering/renderer_scene_cull.cpp:3405-3467`): the diameter the range
 * projects onto the camera's near plane, over the sum of that plane's half extents.
 */

import * as THREE from 'three';
import { CMP_EPSILON, isZeroApprox } from '../../godot/math.js';
import type { ViewingCamera } from '../directionalShadow/fitDirectionalShadowBox.js';

/** An omni light's coverage: its position and a point one range along the camera's right axis. */
export function omniShadowCoverage(position: THREE.Vector3, range: number, camera: ViewingCamera): number {
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  return nearPlaneCoverage([position.clone(), position.clone().addScaledVector(right, range)], camera);
}

/**
 * A spot light's coverage: the centre of its cone's base, one range away at the cone's edge, and a
 * point the base's radius along the camera's right axis. `angle` is `spot_angle` in radians and
 * `direction` the unit vector the light shines along.
 */
export function spotShadowCoverage(
  position: THREE.Vector3,
  direction: THREE.Vector3,
  range: number,
  angle: number,
  camera: ViewingCamera
): number {
  const base = position.clone().addScaledVector(direction, range * Math.cos(angle));
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  return nearPlaneCoverage([base, base.clone().addScaledVector(right, range * Math.sin(angle))], camera);
}

/**
 * A perspective camera first maps both points onto its near plane along the ray from its eye. An
 * orthogonal camera measures them where they are.
 */
function nearPlaneCoverage(points: [THREE.Vector3, THREE.Vector3], camera: ViewingCamera): number {
  if (!camera.isOrthographicCamera) {
    const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const nearPlane = cameraNearPlane(camera, eye);
    for (const point of points) mapOntoNearPlane(point, eye, nearPlane, camera.near);
  }
  const halfExtents = viewportHalfExtents(camera);
  return (points[0].distanceTo(points[1]) * 2) / (halfExtents.x + halfExtents.y);
}

/** `renderer_scene_cull.cpp:3411`: facing the view, `zn` in front of the eye. */
function cameraNearPlane(camera: ViewingCamera, eye: THREE.Vector3): THREE.Plane {
  const back = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
  const forward = back.clone().negate();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    forward,
    eye.clone().addScaledVector(back, -camera.near)
  );
}

/**
 * `renderer_scene_cull.cpp:3426-3435`. A point nearer than the near plane takes `-zn` as its world z,
 * which Godot calls a small hack to keep the size constant. A segment from the eye that misses the
 * plane leaves the point where it is.
 */
function mapOntoNearPlane(
  point: THREE.Vector3,
  eye: THREE.Vector3,
  nearPlane: THREE.Plane,
  zNear: number
): void {
  if (nearPlane.distanceToPoint(point) < 0) point.z = -zNear;
  const hit = intersectSegment(nearPlane, eye, point);
  if (hit) point.copy(hit);
}

/**
 * `Plane::intersects_segment` (`core/math/plane.cpp:118-136`), which accepts a hit up to
 * `CMP_EPSILON` past either end. three's `Plane.intersectLine` accepts none past them.
 */
function intersectSegment(
  plane: THREE.Plane,
  begin: THREE.Vector3,
  end: THREE.Vector3
): THREE.Vector3 | null {
  const segment = begin.clone().sub(end);
  const den = plane.normal.dot(segment);
  if (isZeroApprox(den)) return null;
  // three's plane keeps `normal · p + constant = 0`, so Godot's `d` is `-constant`.
  const dist = (plane.normal.dot(begin) + plane.constant) / den;
  if (dist < -CMP_EPSILON || dist > 1 + CMP_EPSILON) return null;
  return begin.clone().addScaledVector(segment, -dist);
}

/**
 * `Projection::get_viewport_half_extents` (`core/math/projection.cpp:418-425`): the near plane's half
 * width and height. three's `elements` are column-major, so Godot's `columns[c][r]` is
 * `elements[c * 4 + r]`.
 */
function viewportHalfExtents(camera: ViewingCamera): THREE.Vector2 {
  const m = camera.projectionMatrix.elements;
  const w = -camera.near * m[11]! + m[15]!;
  return new THREE.Vector2(w / m[0]!, w / m[5]!);
}
