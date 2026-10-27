/** The three.js lights that stand for the environment's ambient, not for a Light3D of the scene. */

import type * as THREE from 'three';

/**
 * @oneWay Whether a light stands for the environment's ambient
 */
export function isAmbientLight(object: THREE.Object3D): object is THREE.Light {
  const o = object as THREE.Object3D & Record<string, unknown>;
  return !!(o.isAmbientLight || o.isHemisphereLight || o.isLightProbe);
}
