/**
 * How much of the screen an omni or spot light's range covers, as Godot measures it to choose the
 * light's shadow slot (`servers/rendering/renderer_scene_cull.cpp:3405-3467`): the diameter the range
 * projects onto the camera's near plane, over the sum of that plane's half extents.
 */

import * as THREE from 'three';
import { CMP_EPSILON, isZeroApprox } from '../../godot/math.js';
import type { ViewingCamera } from '../directionalShadow/fitDirectionalShadowBox.js';

/**
 * The fit measures every light on every render, so the measure works in these. Each coverage call
 * writes them, and they are valid only inside that call.
 */
const scratchNear = new THREE.Vector3();
const scratchFar = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchEye = new THREE.Vector3();
const scratchBack = new THREE.Vector3();
const scratchForward = new THREE.Vector3();
const scratchCoplanar = new THREE.Vector3();
const scratchSegment = new THREE.Vector3();
const scratchNearPlane = new THREE.Plane();

/** An omni light's coverage: its position and a point one range along the camera's right axis. */
export function omniShadowCoverage(position: THREE.Vector3, range: number, camera: ViewingCamera): number {
  const right = scratchRight.setFromMatrixColumn(camera.matrixWorld, 0);
  scratchNear.copy(position);
  scratchFar.copy(position).addScaledVector(right, range);
  return nearPlaneCoverage(scratchNear, scratchFar, camera);
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
  const base = scratchNear.copy(position).addScaledVector(direction, range * Math.cos(angle));
  const right = scratchRight.setFromMatrixColumn(camera.matrixWorld, 0);
  scratchFar.copy(base).addScaledVector(right, range * Math.sin(angle));
  return nearPlaneCoverage(base, scratchFar, camera);
}

/**
 * A perspective camera first maps both points onto its near plane along the ray from its eye, in
 * place. An orthogonal camera measures them where they are.
 */
function nearPlaneCoverage(near: THREE.Vector3, far: THREE.Vector3, camera: ViewingCamera): number {
  if (!camera.isOrthographicCamera) {
    const eye = scratchEye.setFromMatrixPosition(camera.matrixWorld);
    const nearPlane = cameraNearPlane(camera, eye);
    mapOntoNearPlane(near, eye, nearPlane, camera.near);
    mapOntoNearPlane(far, eye, nearPlane, camera.near);
  }
  return (near.distanceTo(far) * 2) / viewportHalfExtentSum(camera);
}

/** `renderer_scene_cull.cpp:3411`: facing the view, `zn` in front of the eye. */
function cameraNearPlane(camera: ViewingCamera, eye: THREE.Vector3): THREE.Plane {
  const back = scratchBack.setFromMatrixColumn(camera.matrixWorld, 2);
  const forward = scratchForward.copy(back).negate();
  return scratchNearPlane.setFromNormalAndCoplanarPoint(
    forward,
    scratchCoplanar.copy(eye).addScaledVector(back, -camera.near)
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
  intersectSegment(nearPlane, eye, point, point);
}

/**
 * `Plane::intersects_segment` (`core/math/plane.cpp:118-136`), which accepts a hit up to
 * `CMP_EPSILON` past either end. three's `Plane.intersectLine` accepts none past them. A hit goes
 * into `target`, which may be `end`, and a miss leaves `target` as it is.
 */
function intersectSegment(
  plane: THREE.Plane,
  begin: THREE.Vector3,
  end: THREE.Vector3,
  target: THREE.Vector3
): void {
  const segment = scratchSegment.copy(begin).sub(end);
  const den = plane.normal.dot(segment);
  if (isZeroApprox(den)) return;
  // three's plane keeps `normal · p + constant = 0`, so Godot's `d` is `-constant`.
  const dist = (plane.normal.dot(begin) + plane.constant) / den;
  if (dist < -CMP_EPSILON || dist > 1 + CMP_EPSILON) return;
  target.copy(begin).addScaledVector(segment, -dist);
}

/**
 * The sum of the near plane's half width and height, from `Projection::get_viewport_half_extents`
 * (`core/math/projection.cpp:418-425`). three's `elements` are column-major, so Godot's
 * `columns[c][r]` is `elements[c * 4 + r]`.
 */
function viewportHalfExtentSum(camera: ViewingCamera): number {
  const m = camera.projectionMatrix.elements;
  const w = -camera.near * m[11]! + m[15]!;
  return w / m[0]! + w / m[5]!;
}
