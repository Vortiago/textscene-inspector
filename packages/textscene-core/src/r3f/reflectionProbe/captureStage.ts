/**
 * The scene as a reflection probe capture draws it (`renderer_scene_cull.cpp:3708-3711`): only the
 * instances on the probe's cull mask, and no environment for an interior probe
 * (`render_forward_clustered.cpp:1819-1821`), which clears to the default clear colour instead.
 */

import type * as THREE from 'three';
import type { ReflectionProbeProperties } from '../../nodes/3d/reflectionprobe/types.js';
import { isAmbientLight } from '../ambientLight.js';
import { hideObjects, isEditorHelper } from '../editorHelpers.js';
import { scaleLightIntensities } from '../exposure/scaleLightIntensities.js';
import { isInMask } from '../visualLayers.js';

/**
 * Stages `scene` for a capture of `probe`, and answers the call that puts it back. An interior
 * capture clears to `clearColor`, the project's default clear colour.
 */
export function stageCapture(
  scene: THREE.Scene,
  probe: Pick<ReflectionProbeProperties, 'cullMask' | 'interior'>,
  clearColor: THREE.Color
): () => void {
  const restores = [hideCulled(scene, probe.cullMask)];
  if (probe.interior) restores.push(dropEnvironment(scene, clearColor));
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/** Whether `object` is an instance Godot culls by its layers: a drawn surface or a light. */
function isInstance(object: THREE.Object3D): boolean {
  const o = object as THREE.Object3D & Record<string, unknown>;
  return !!(
    o.isMesh ||
    o.isLine ||
    o.isPoints ||
    o.isSprite ||
    o.isDirectionalLight ||
    o.isPointLight ||
    o.isSpotLight ||
    o.isRectAreaLight
  );
}

/** Hides the instances outside `cullMask`, and the editor chrome, which no scene mask holds. */
function hideCulled(scene: THREE.Scene, cullMask: number): () => void {
  return hideObjects(
    scene,
    (object) => isEditorHelper(object) || (isInstance(object) && !isInMask(object, cullMask))
  );
}

function dropEnvironment(scene: THREE.Scene, clearColor: THREE.Color): () => void {
  const { environmentIntensity, background } = scene;
  const ambients: THREE.Light[] = [];
  scene.traverse((object) => {
    if (isAmbientLight(object)) ambients.push(object);
  });
  // The intensity, not `environment`: a program compiles `USE_ENVMAP` from the environment.
  scene.environmentIntensity = 0;
  scene.background = clearColor;
  const restoreAmbients = scaleLightIntensities(ambients, 0);
  return () => {
    scene.environmentIntensity = environmentIntensity;
    scene.background = background;
    restoreAmbients();
  };
}
