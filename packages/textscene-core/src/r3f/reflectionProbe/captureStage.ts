/**
 * The scene as a reflection probe capture draws it (`renderer_scene_cull.cpp:3708-3711`): only the
 * instances on the probe's cull mask, and no environment for an interior probe
 * (`render_forward_clustered.cpp:1819-1821`), which clears to the default clear colour instead.
 */

import * as THREE from 'three';
import { visualLayersOf } from '../visualLayers.js';

export interface CaptureStage {
  cullMask: number;
  isInterior: boolean;
  /** The project's default clear colour, which an interior capture clears to. */
  clearColor: THREE.Color;
}

/** Stages `scene` for a capture, and answers the call that puts it back. */
export function stageCapture(scene: THREE.Scene, stage: CaptureStage): () => void {
  const restores = [hideCulled(scene, stage.cullMask)];
  if (stage.isInterior) restores.push(dropEnvironment(scene, stage.clearColor));
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

function hideCulled(scene: THREE.Scene, cullMask: number): () => void {
  const hidden: THREE.Object3D[] = [];
  scene.traverseVisible((object) => {
    if (isInstance(object) && (visualLayersOf(object) & cullMask) === 0) hidden.push(object);
  });
  for (const object of hidden) object.visible = false;
  return () => {
    for (const object of hidden) object.visible = true;
  };
}

/** The lights that stand for the environment's ambient, which an interior capture drops. */
function isAmbient(object: THREE.Object3D): object is THREE.Light {
  const o = object as THREE.Object3D & Record<string, unknown>;
  return !!(o.isAmbientLight || o.isHemisphereLight || o.isLightProbe);
}

function dropEnvironment(scene: THREE.Scene, clearColor: THREE.Color): () => void {
  const { environmentIntensity, background } = scene;
  const ambients: { light: THREE.Light; intensity: number }[] = [];
  scene.traverse((object) => {
    if (isAmbient(object)) ambients.push({ light: object, intensity: object.intensity });
  });
  // The intensity, not `environment`: a program compiles `USE_ENVMAP` from the environment.
  scene.environmentIntensity = 0;
  scene.background = clearColor;
  for (const { light } of ambients) light.intensity = 0;
  return () => {
    scene.environmentIntensity = environmentIntensity;
    scene.background = background;
    for (const { light, intensity } of ambients) light.intensity = intensity;
  };
}
