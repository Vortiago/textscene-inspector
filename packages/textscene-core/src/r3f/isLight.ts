/** Whether an object is a three.js light. */

import type * as THREE from 'three';

/**
 * @canonical Whether an object is a three.js light
 */
export function isLight(object: THREE.Object3D): object is THREE.Light {
  return (object as THREE.Light).isLight === true;
}
