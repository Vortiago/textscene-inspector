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
import { sceneLights } from '../directionalShadow/lightLists.js';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { EMISSION_EXPOSURE } from './emissionExposure.js';
import { scaleLightIntensities } from './scaleLightIntensities.js';
import { perObject } from '../../utils/perObject.js';

/**
 * What a consumer draws for `exposure`, in place of what it draws for the exposure the scene holds.
 * It answers the call that puts its state back.
 */
export type ExposureStage = (exposure: number | null) => () => void;

/** What a scene's world holds: the factor its scene renders with, and the factor of its own attributes. */
interface HeldExposure {
  view: number | null;
  world: number | null;
}

/**
 * Each scene's held exposures, the latest last. A list, not one entry: the shared-world viewports of
 * a 2D canvas all hold its one scene. Written only by `useSceneExposure`, each entry removed when its
 * world unmounts.
 */
const heldOf = perObject<THREE.Scene, HeldExposure[]>(() => []);

function latestHeld(scene: THREE.Scene): HeldExposure | undefined {
  const entries = heldOf(scene);
  return entries[entries.length - 1];
}

/** The exposure `drawAtExposure` draws a scene at, written only by it and cleared when the draw ends. */
// eslint-disable-next-line no-restricted-syntax -- drawAtExposure writes an entry for one draw and deletes it after the draw
const drawnExposures = new WeakMap<THREE.Scene, number>();

/** Each scene's exposure stages, filled only by `registerExposureStage`. */
const stagesOf = perObject<THREE.Scene, Set<ExposureStage>>(() => new Set());

/**
 * The factor `scene` renders with, or null without a world that holds an exposure.
 *
 * @canonical The exposure a scene renders with
 */
export function exposureOfScene(scene: THREE.Scene): number | null {
  return latestHeld(scene)?.view ?? null;
}

/**
 * The factor of the attributes of the world of `scene` itself, or null without them. A camera of
 * the world may render it with others (`exposureOfScene`).
 *
 * @canonical The exposure a scene renders with
 */
export function worldExposureOfScene(scene: THREE.Scene): number | null {
  return latestHeld(scene)?.world ?? null;
}

/**
 * Has `stage` run for each `drawAtExposure` of `scene` until the returned function runs. A consumer
 * whose state follows the exposure registers one, so a draw at another exposure shows it.
 *
 * @canonical The state a scene draws for another exposure
 */
export function registerExposureStage(scene: THREE.Scene, stage: ExposureStage): () => void {
  const registered = stagesOf(scene);
  registered.add(stage);
  return () => {
    registered.delete(stage);
  };
}

/**
 * Runs `draw` with `scene` set for `exposure`, null for none, and puts the scene back after it. A draw
 * at the exposure the scene holds changes nothing. A light scales by the exposure over the held one,
 * so a scene at the held exposure 0, whose lights hold no energy, keeps them dark.
 *
 * @canonical The state a scene draws for another exposure
 */
export function drawAtExposure<T>(scene: THREE.Scene, exposure: number | null, draw: () => T): T {
  if (exposure === exposureOfScene(scene)) return draw();
  const factor = exposure ?? 1;
  const restores: (() => void)[] = [];
  try {
    drawnExposures.set(scene, factor);
    EMISSION_EXPOSURE[0] = factor;
    restores.push(scaleLights(scene, drawnExposureRatio(scene)));
    for (const stage of stagesOf(scene)) restores.push(stage(exposure));
    return draw();
  } finally {
    for (const restore of restores.reverse()) restore();
    drawnExposures.delete(scene);
    EMISSION_EXPOSURE[0] = 1;
  }
}

/**
 * The scale from the held exposure to the one `drawAtExposure` draws at, or 1 outside a draw and
 * under a held exposure of 0. A light that sets its own energy before each render applies it, since
 * `drawAtExposure` scales the energy only once.
 *
 * @canonical The state a scene draws for another exposure
 */
export function drawnExposureRatio(scene: THREE.Scene): number {
  const drawn = drawnExposures.get(scene);
  const held = exposureOfScene(scene) ?? 1;
  return drawn === undefined || held === 0 ? 1 : drawn / held;
}

/** Scales the energy of each Light3D of `scene` by `ratio`: the flat ambient takes no exposure. */
function scaleLights(scene: THREE.Scene, ratio: number): () => void {
  const lights = sceneLights(scene)
    .map(({ light }) => light)
    .filter((light) => !isAmbientLight(light));
  return scaleLightIntensities(lights, ratio);
}

/** Writes `factor` to the emission buffer for each render of `scene` until the returned function runs. */
function writeEmissionExposure(scene: THREE.Scene, factor: number): () => void {
  const stopWriting = observeSceneCamera(scene, () => {
    EMISSION_EXPOSURE[0] = drawnExposures.get(scene) ?? factor;
  });
  const stopClearing = observeSceneRenderEnd(scene, () => {
    EMISSION_EXPOSURE[0] = 1;
  });
  return () => {
    stopWriting();
    stopClearing();
  };
}

/**
 * Renders the scene of the enclosing world with `factor` until the world unmounts, and answers
 * `worldFactor` as the factor of its own attributes. A null factor holds nothing: the emission
 * buffer already reads 1 outside a render of a world that holds one.
 *
 * @canonical The exposure a scene renders with
 */
export function useSceneExposure(factor: number | null, worldFactor: number | null): void {
  const scene = useThree((state) => state.scene);
  // A layout effect, so the buffer changes in the commit that changes every light's intensity.
  useLayoutEffect(() => {
    const entry: HeldExposure = { view: factor, world: worldFactor };
    const entries = heldOf(scene);
    entries.push(entry);
    const stopWriting = factor === null ? undefined : writeEmissionExposure(scene, factor);
    return () => {
      stopWriting?.();
      entries.splice(entries.indexOf(entry), 1);
    };
  }, [scene, factor, worldFactor]);
}
