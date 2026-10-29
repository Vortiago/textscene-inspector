/** The flat ambient lights a scene shows, which an Environment adds to the scene while it is on it. */

import type * as THREE from 'three';

export function shownAmbientLights(scene: THREE.Object3D): THREE.AmbientLight[] {
  const lights: THREE.AmbientLight[] = [];
  scene.traverseVisible((object) => {
    if ((object as THREE.AmbientLight).isAmbientLight) lights.push(object as THREE.AmbientLight);
  });
  return lights;
}
