/**
 * The six cameras of a reflection probe capture (`renderer_scene_cull.cpp:3666-3711`), and the
 * capture each one draws, which the scene's observers read to draw a capture as Godot does.
 */

import * as THREE from 'three';
import { CAPTURE_NEAR, FACE_NORMALS } from '../../godot/reflectionProbe.js';
import type { Xyz } from '../../godot/xyz.js';

/** What a capture's renders draw differently from the scene's own. */
export interface ProbeCapture {
  /** No environment: no sky, no ambient light and no fog (`render_forward_clustered.cpp:1819-1821`). */
  readonly isInterior: boolean;
  /** Whether the lights cast their shadows (`render_forward_clustered.cpp:1627-1630`). */
  readonly hasShadows: boolean;
}

/**
 * Each face's up, beside its view direction in `FACE_NORMALS`. They match three's cube cameras, so
 * a face lands in its own face of a cube render target.
 */
const FACE_UPS: readonly THREE.Vector3[] = [
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, -1, 0),
];

/** Written only by `captureCameras`. A camera leaves it once it is collected. */
const captures = new WeakMap<THREE.Camera, ProbeCapture>();

/** The capture `camera` draws, or undefined for a camera that draws none. */
export function probeCaptureOf(camera: THREE.Camera): ProbeCapture | undefined {
  return captures.get(camera);
}

/** Scratch for one frame or one face's pose, overwritten by each. */
const eye = new THREE.Vector3();
const target = new THREE.Vector3();
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const scale = new THREE.Vector3();

/** The probe's frame: its world transform without the scale, which the probe disables (`reflection_probe.cpp:304-308`). */
export function probeFrame(probeWorld: THREE.Matrix4): THREE.Matrix4 {
  probeWorld.decompose(position, rotation, scale);
  return new THREE.Matrix4().compose(position, rotation, scale.set(1, 1, 1));
}

/**
 * The cameras of a capture from `originOffset` in the probe's frame, each 90 degrees square from
 * Godot's near plane to its own far plane.
 */
export function captureCameras(
  probeWorld: THREE.Matrix4,
  originOffset: Xyz,
  farPlanes: readonly number[],
  capture: ProbeCapture
): THREE.PerspectiveCamera[] {
  const frame = probeFrame(probeWorld);
  eye.set(originOffset.x, originOffset.y, originOffset.z);
  return FACE_NORMALS.map((normal, face) => {
    const camera = new THREE.PerspectiveCamera(90, 1, CAPTURE_NEAR, farPlanes[face]);
    target.set(eye.x + normal.x, eye.y + normal.y, eye.z + normal.z);
    const local = new THREE.Matrix4().lookAt(eye, target, FACE_UPS[face]!).setPosition(eye);
    camera.matrixWorld.multiplyMatrices(frame, local);
    camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    // The render would otherwise compose the matrix again from the pose, losing the exact frame.
    camera.matrixAutoUpdate = false;
    camera.matrixWorldAutoUpdate = false;
    captures.set(camera, capture);
    return camera;
  });
}
