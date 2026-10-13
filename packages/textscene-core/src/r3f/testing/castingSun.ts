/** A directional light that casts through its split sun, as the fitter leaves one. */

import * as THREE from 'three';
import { attachSplitSun } from '../directionalShadow/splitSun';

/**
 * A sun that casts in one split of the whole atlas: a box 10 units square from 10 units in front of
 * the origin to 10 units behind it, so the origin lands at the atlas's centre, halfway deep. Its
 * split ends at 12 units, and its shadow fades from 9.6 to 12 at an opacity of 0.8.
 */
export function castingSun(): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 0, 10);
  light.castShadow = true;
  const scene = new THREE.Scene();
  scene.add(light, light.target);
  scene.updateMatrixWorld();
  const sun = attachSplitSun(light);
  sun.shadow.setSplits(1, { x: 0, y: 0, width: 4096, height: 4096 });
  const split = sun.shadow.getCamera(0);
  Object.assign(split, { left: -5, right: 5, top: 5, bottom: -5, near: 0, far: 20 });
  split.position.set(0, 0, 10);
  split.lookAt(0, 0, 0);
  split.updateProjectionMatrix();
  split.updateMatrixWorld();
  for (const slot of sun.shadow._cascadeData) slot.x = 12;
  sun.shadow.fade = { from: 9.6, to: 12 };
  sun.shadow.intensity = 0.8;
  sun.shadow.updateMatrices(sun);
  return light;
}
