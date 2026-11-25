import * as THREE from 'three';
import { flatAmbientEnergy, isFlatAmbientLight } from '../ambientLight.js';
import { TrackedObjects } from '../trackedObjects.js';
import { visibleInTree } from '../visibleInTree.js';
import { perObject } from '../../utils/perObject.js';
import { hasEnvironmentOn } from '../environment/sceneEnvironment.js';

const trackedAmbientLightsOf = perObject(
  (scene: THREE.Scene) => new TrackedObjects(scene, isFlatAmbientLight)
);

/** Scratch for one light's colour, overwritten by the next. */
const scaledColor = new THREE.Color();

/** Each scene's ambient light of the last render that read it. Written only by `sceneAmbientLight`. */
const lastAmbientOf = perObject((_scene: THREE.Scene) => ({ renderId: NaN, color: new THREE.Color() }));

/** `ambient_light_color_energy`, once a render and with no sky light (`render_scene_data_rd.cpp:163-233`). */
export function sceneAmbientLight(
  scene: THREE.Scene,
  clearColor: THREE.Color,
  renderId: number
): THREE.Color {
  const last = lastAmbientOf(scene);
  if (last.renderId === renderId) return last.color;
  last.renderId = renderId;
  return hasEnvironmentOn(scene) ? sumOfFlatAmbientLights(scene, last.color) : last.color.copy(clearColor);
}

function sumOfFlatAmbientLights(scene: THREE.Scene, target: THREE.Color): THREE.Color {
  target.setRGB(0, 0, 0);
  for (const light of trackedAmbientLightsOf(scene).current()) {
    if (!visibleInTree(light)) continue;
    target.add(scaledColor.copy(light.color).multiplyScalar(flatAmbientEnergy(light)));
  }
  return target;
}
