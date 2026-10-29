/**
 * The flat ambient lights a scene shows, which an Environment shows while it is on the scene. Only
 * `AmbientLight`, not every light `isAmbientLight` takes, since a caller reads its one colour.
 */

import type * as THREE from 'three';

export function shownAmbientLights(scene: THREE.Object3D): THREE.AmbientLight[] {
  const lights: THREE.AmbientLight[] = [];
  scene.traverseVisible((object) => {
    if ((object as THREE.AmbientLight).isAmbientLight) lights.push(object as THREE.AmbientLight);
  });
  return lights;
}
