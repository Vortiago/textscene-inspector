import * as THREE from 'three';
import { flatAmbientEnergy } from '../ambientLight.js';
import { TrackedObjects } from '../trackedObjects.js';
import { visibleInTree } from '../visibleInTree.js';
import { perObject } from '../../utils/perObject.js';
import { hasEnvironmentOn } from '../environment/sceneEnvironment.js';

function isFlatAmbient(object: THREE.Object3D): object is THREE.AmbientLight {
  return (object as THREE.AmbientLight).isAmbientLight === true;
}

const trackedAmbientLightsOf = perObject((scene: THREE.Scene) => new TrackedObjects(scene, isFlatAmbient));

/** Scratch for one light's colour, overwritten by the next. */
const scaledColor = new THREE.Color();

/** `ambient_light_color_energy` (`render_scene_data_rd.cpp:163-193`, `:226-233`), with no sky light. */
export function sceneAmbientLight(
  scene: THREE.Scene,
  clearColor: THREE.Color,
  target: THREE.Color
): THREE.Color {
  if (!hasEnvironmentOn(scene)) return target.copy(clearColor);
  target.setRGB(0, 0, 0);
  for (const light of trackedAmbientLightsOf(scene).current()) {
    if (!visibleInTree(light)) continue;
    target.add(scaledColor.copy(light.color).multiplyScalar(flatAmbientEnergy(light)));
  }
  return target;
}
