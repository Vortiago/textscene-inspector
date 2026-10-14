/**
 * The six cameras of a reflection probe capture (`renderer_scene_cull.cpp:3666-3711`), and the
 * capture each one draws, which the scene's observers read to draw a capture as Godot does.
 */

import * as THREE from 'three';
import { CAPTURE_NEAR } from '../../godot/reflectionProbe.js';
import type { Xyz } from '../../godot/xyz.js';

/** What a capture's renders draw differently from the scene's own. */
export interface ProbeCapture {
  /** No environment: no sky, no ambient light and no fog (`render_forward_clustered.cpp:1819-1821`). */
  readonly isInterior: boolean;
  /** Whether the lights cast their shadows (`render_forward_clustered.cpp:1627-1630`). */
  readonly hasShadows: boolean;
}

/**
 * Each face's view direction and up, in Godot's face order. They match three's cube cameras, so a
 * face lands in its own face of a cube render target.
 */
const FACES: readonly { normal: THREE.Vector3; up: THREE.Vector3 }[] = [
  { normal: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, -1, 0) },
  { normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, -1, 0) },
  { normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, 1) },
  { normal: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, -1) },
  { normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, -1, 0) },
  { normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, -1, 0) },
];

/** Written only by `captureCameras`. A camera leaves it once it is collected. */
const captures = new WeakMap<THREE.Camera, ProbeCapture>();

/** The capture `camera` draws, or undefined for a camera that draws none. */
export function probeCaptureOf(camera: THREE.Camera): ProbeCapture | undefined {
  return captures.get(camera);
}

/** Scratch for one face's pose, overwritten by each. */
const eye = new THREE.Vector3();
const target = new THREE.Vector3();
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const scale = new THREE.Vector3();

/**
 * The cameras of a capture from `originOffset` in the probe's frame `probeWorld`, each 90 degrees
 * square from Godot's near plane to its own far plane. The probe disables its scale
 * (`reflection_probe.cpp:304-308`), so the frame drops it.
 */
export function captureCameras(
  probeWorld: THREE.Matrix4,
  originOffset: Xyz,
  farPlanes: readonly number[],
  capture: ProbeCapture
): THREE.PerspectiveCamera[] {
  probeWorld.decompose(position, rotation, scale);
  const frame = new THREE.Matrix4().compose(position, rotation, scale.set(1, 1, 1));
  eye.set(originOffset.x, originOffset.y, originOffset.z);
  return FACES.map(({ normal, up }, face) => {
    const camera = new THREE.PerspectiveCamera(90, 1, CAPTURE_NEAR, farPlanes[face]);
    const local = new THREE.Matrix4().lookAt(eye, target.addVectors(eye, normal), up).setPosition(eye);
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
