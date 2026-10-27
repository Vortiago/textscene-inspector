/**
 * The exposure each scene renders with. A scene writes its world's factor into the shared emission
 * buffer for each render it takes and puts 1 back when the render ends, so each world, a
 * sub-viewport included, draws with its own. `drawAtExposure` draws it at another exposure, as
 * Godot captures a reflection probe at the exposure of the world and not of the camera.
 */

import { useLayoutEffect } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { isAmbientLight } from '../ambientLight.js';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { EMISSION_EXPOSURE } from './emissionExposure.js';

/**
 * What a consumer draws for `exposure`, in place of what it draws for the exposure the scene holds.
 * It answers the call that puts its state back.
 */
export type ExposureStage = (exposure: number | null) => () => void;

/** Written only by `useSceneExposure`, and cleared when that scene's world unmounts. */
const exposures = new WeakMap<THREE.Scene, number>();

/** The factor of the world's own attributes. Written and cleared only with `exposures`. */
const worldExposures = new WeakMap<THREE.Scene, number>();

/** The exposure `drawAtExposure` draws a scene at, written only by it and cleared when the draw ends. */
const drawnExposures = new WeakMap<THREE.Scene, number>();

const stages = new WeakMap<THREE.Scene, Set<ExposureStage>>();

/**
 * The factor `scene` renders with, or null without a world that holds an exposure.
 *
 * @oneWay The exposure a scene renders with
 */
export function exposureOfScene(scene: THREE.Scene): number | null {
  return exposures.get(scene) ?? null;
}

/**
 * The factor of the attributes of the world of `scene` itself, or null without them. A camera of
 * the world may render it with others (`exposureOfScene`).
 *
 * @oneWay The exposure a scene renders with
 */
export function worldExposureOfScene(scene: THREE.Scene): number | null {
  return worldExposures.get(scene) ?? null;
}

/**
 * Has `stage` run for each `drawAtExposure` of `scene` until the returned function runs. A consumer
 * whose state follows the exposure registers one, so a draw at another exposure shows it.
 *
 * @oneWay The state a scene draws for another exposure
 */
export function registerExposureStage(scene: THREE.Scene, stage: ExposureStage): () => void {
  const registered = stages.get(scene) ?? new Set<ExposureStage>();
  stages.set(scene, registered);
  registered.add(stage);
  return () => {
    registered.delete(stage);
  };
}

/**
 * Runs `draw` with `scene` set for `exposure`, null for none, and puts the scene back after it. A draw
 * at the exposure the scene holds changes nothing. A light scales by the exposure over the held one,
 * so a scene at the held exposure 0, which holds no energy to scale, is not drawn at another.
 *
 * @oneWay The state a scene draws for another exposure
 */
export function drawAtExposure<T>(scene: THREE.Scene, exposure: number | null, draw: () => T): T {
  const held = exposureOfScene(scene);
  if (exposure === held) return draw();
  const factor = exposure ?? 1;
  drawnExposures.set(scene, factor);
  EMISSION_EXPOSURE[0] = factor;
  const restores = [
    scaleLights(scene, factor / (held ?? 1)),
    ...[...(stages.get(scene) ?? [])].map((stage) => stage(exposure)),
  ];
  try {
    return draw();
  } finally {
    for (const restore of restores.reverse()) restore();
    drawnExposures.delete(scene);
    EMISSION_EXPOSURE[0] = 1;
  }
}

/** Scales the energy of each Light3D of `scene` by `ratio`: the flat ambient takes no exposure. */
function scaleLights(scene: THREE.Scene, ratio: number): () => void {
  const scaled: { light: THREE.Light; intensity: number }[] = [];
  scene.traverse((object) => {
    const light = object as THREE.Light;
    if (light.isLight && !isAmbientLight(object)) scaled.push({ light, intensity: light.intensity });
  });
  for (const { light, intensity } of scaled) light.intensity = intensity * ratio;
  return () => {
    for (const { light, intensity } of scaled) light.intensity = intensity;
  };
}

/** Renders `scene` with `factor` until the returned function runs. */
function holdSceneExposure(scene: THREE.Scene, factor: number): () => void {
  exposures.set(scene, factor);
  const stopWriting = observeSceneCamera(scene, () => {
    EMISSION_EXPOSURE[0] = drawnExposures.get(scene) ?? factor;
  });
  const stopClearing = observeSceneRenderEnd(scene, () => {
    EMISSION_EXPOSURE[0] = 1;
  });
  return () => {
    stopWriting();
    stopClearing();
    exposures.delete(scene);
  };
}

/**
 * Renders the scene of the enclosing world with `factor` until the world unmounts, and answers
 * `worldFactor` as the factor of its own attributes. A null factor holds nothing: the emission
 * buffer already reads 1 outside a render of a world that holds one.
 *
 * @oneWay The exposure a scene renders with
 */
export function useSceneExposure(factor: number | null, worldFactor: number | null): void {
  const scene = useThree((state) => state.scene);
  // A layout effect, so the buffer changes in the commit that changes every light's intensity.
  useLayoutEffect(() => (factor === null ? undefined : holdSceneExposure(scene, factor)), [scene, factor]);
  useLayoutEffect(() => {
    if (worldFactor === null) return undefined;
    worldExposures.set(scene, worldFactor);
    return () => {
      worldExposures.delete(scene);
    };
  }, [scene, worldFactor]);
}
