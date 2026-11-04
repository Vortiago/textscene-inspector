/**
 * The exposure each render of a scene draws at, through one path. A scene holds its world's factor,
 * and `drawAtExposure` draws it at another, as Godot captures a reflection probe at the exposure of
 * the world and not of the camera. Each render scales every light's energy and the emission by the
 * factor it draws at, and runs each follower with it, as Godot fills its buffers for each render
 * (`light_storage.cpp:656-658`, `:884-886`, `scene_forward_clustered.glsl:1679-1683`).
 */

import { useLayoutEffect } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { isAmbientLight } from '../ambientLight.js';
import { isLight } from '../isLight.js';
import { observeSceneExposure, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { TrackedObjects } from '../trackedObjects.js';
import { EMISSION_EXPOSURE } from './emissionExposure.js';
import { ScaledLights } from './scaledLights.js';

/**
 * What a consumer draws for the exposure of one render through `camera`, null for a render with no
 * CameraAttributes. It writes its state for each render, so it puts nothing back.
 */
export type ExposureFollower = (exposure: number | null, camera: THREE.Camera) => void;

/** What a scene's world holds: the factor its scene renders with, and the factor of its own attributes. */
interface HeldExposure {
  view: number | null;
  world: number | null;
}

/** What applies the exposure to the renders of one scene. */
interface SceneExposure {
  /**
   * The held exposures, the latest last. A list, not one entry: the shared-world viewports of a 2D
   * canvas all hold its one scene.
   */
  held: HeldExposure[];
  followers: Set<ExposureFollower>;
  /**
   * Takes the hooks off the renders of the scene. Present only while a render needs the exposure,
   * so a scene without one keeps three's own hooks.
   */
  unhookRenders: (() => void) | null;
  /**
   * Every light but the flat ambient, which takes no exposure. Made by the first render that scales
   * them, so a scene whose renders all draw at 1 tracks none, and kept until the exposure is removed.
   */
  lights: TrackedObjects<THREE.Light> | null;
  /** The lights the render under way scaled. */
  scaled: ScaledLights;
  /** Whether a render is under way, whose changes `endRender` puts back. */
  isRendering: boolean;
}

/**
 * Each scene's exposure, made by the first held exposure, follower or draw, and removed with the
 * last. Written only by `useSceneExposure`, `followSceneExposure` and `drawAtExposure`.
 */
// eslint-disable-next-line no-restricted-syntax -- the last holder's release deletes the scene's entry
const exposures = new WeakMap<THREE.Scene, SceneExposure>();

/** A draw at an exposure, null for none. Boxed, so a draw at null reads as a draw. */
interface DrawnExposure {
  exposure: number | null;
}

/** The exposure `drawAtExposure` draws a scene at, written only by it and cleared when the draw ends. */
// eslint-disable-next-line no-restricted-syntax -- drawAtExposure writes an entry for one draw and deletes it after the draw
const drawnExposures = new WeakMap<THREE.Scene, DrawnExposure>();

function isExposedLight(object: THREE.Object3D): object is THREE.Light {
  return isLight(object) && !isAmbientLight(object);
}

/** The exposure of `scene`, made on the first ask. The caller settles it with `settleExposure`. */
function exposureOf(scene: THREE.Scene): SceneExposure {
  const existing = exposures.get(scene);
  if (existing) return existing;
  const exposure: SceneExposure = {
    held: [],
    followers: new Set(),
    unhookRenders: null,
    lights: null,
    scaled: new ScaledLights(),
    isRendering: false,
  };
  exposures.set(scene, exposure);
  return exposure;
}

/** Whether a render of `scene` draws at an exposure, or runs a follower. */
function needsRenderHooks(scene: THREE.Scene, exposure: SceneExposure): boolean {
  return (
    exposure.followers.size > 0 ||
    drawnExposures.has(scene) ||
    exposure.held.some(({ view }) => view !== null)
  );
}

/** Applies the exposure to each render of `scene`, until the returned function runs. */
function hookRenders(scene: THREE.Scene, exposure: SceneExposure): () => void {
  const stopApplying = observeSceneExposure(scene, (camera) => applyRenderExposure(scene, exposure, camera));
  const stopRestoring = observeSceneRenderEnd(scene, () => endRender(exposure));
  return () => {
    stopApplying();
    stopRestoring();
  };
}

/**
 * Hooks the renders of `scene` while one needs the exposure, unhooks them after, and removes the
 * exposure once nothing holds it.
 */
function settleExposure(scene: THREE.Scene, exposure: SceneExposure): void {
  if (needsRenderHooks(scene, exposure)) {
    exposure.unhookRenders ??= hookRenders(scene, exposure);
    return;
  }
  endRender(exposure);
  exposure.unhookRenders?.();
  exposure.unhookRenders = null;
  if (exposure.held.length > 0) return;
  exposure.lights?.dispose();
  exposures.delete(scene);
}

function latestHeld(scene: THREE.Scene): HeldExposure | undefined {
  const held = exposures.get(scene)?.held;
  return held?.[held.length - 1];
}

/**
 * The factor of the attributes of the world of `scene` itself, or null without them. A camera of
 * the world may render it with others.
 *
 * @canonical The exposure of the attributes of a scene's own world
 */
export function worldExposureOfScene(scene: THREE.Scene): number | null {
  return latestHeld(scene)?.world ?? null;
}

/** The exposure a render of `scene` draws at: the one `drawAtExposure` draws at, else the held one. */
function drawnExposureOf(scene: THREE.Scene): number | null {
  const drawn = drawnExposures.get(scene);
  return drawn ? drawn.exposure : (latestHeld(scene)?.view ?? null);
}

function exposedLightsOf(scene: THREE.Scene, exposure: SceneExposure): readonly THREE.Light[] {
  exposure.lights ??= new TrackedObjects(scene, isExposedLight);
  return exposure.lights.current();
}

/** Puts back what the render under way changed. The emission reads 1 again, as outside any render. */
function endRender(exposure: SceneExposure): void {
  if (!exposure.isRendering) return;
  exposure.isRendering = false;
  exposure.scaled.restore();
  EMISSION_EXPOSURE[0] = 1;
}

/**
 * Scales each exposed light and the emission of a render of `scene` by the factor it draws at, 1
 * with no exposure, and runs each follower. A render that never ended is put back first, so a light's
 * energy is scaled once. The emission buffer reads 1 again after the render, as outside any.
 */
function applyRenderExposure(scene: THREE.Scene, exposure: SceneExposure, camera: THREE.Camera): void {
  endRender(exposure);
  exposure.isRendering = true;
  const drawn = drawnExposureOf(scene);
  const factor = drawn ?? 1;
  EMISSION_EXPOSURE[0] = factor;
  // A factor of 1 leaves every light as it holds, so most renders scale none.
  if (factor !== 1) exposure.scaled.scale(exposedLightsOf(scene, exposure), factor);
  for (const follower of exposure.followers) follower(drawn, camera);
}

/**
 * Runs `follower` in each render of `scene` with the exposure the render draws at, until the
 * returned function runs. A consumer whose state follows the exposure follows it here, so a draw
 * at another exposure shows it too.
 *
 * @canonical The state a scene draws for the exposure of a render
 */
export function followSceneExposure(scene: THREE.Scene, follower: ExposureFollower): () => void {
  const exposure = exposureOf(scene);
  exposure.followers.add(follower);
  settleExposure(scene, exposure);
  return () => {
    exposure.followers.delete(follower);
    settleExposure(scene, exposure);
  };
}

/**
 * Runs `draw` with each render of `scene` at `exposure`, null for none. Godot gives each render the
 * exposure of its own camera attributes, so a held exposure of 0 leaves a draw at another lit.
 *
 * @canonical The state a scene draws for the exposure of a render
 */
export function drawAtExposure<T>(scene: THREE.Scene, exposure: number | null, draw: () => T): T {
  const outer = drawnExposures.get(scene);
  drawnExposures.set(scene, { exposure });
  settleExposure(scene, exposureOf(scene));
  try {
    return draw();
  } finally {
    if (outer) drawnExposures.set(scene, outer);
    else drawnExposures.delete(scene);
    settleExposure(scene, exposureOf(scene));
  }
}

/**
 * Renders the scene of the enclosing world with `factor` until the world unmounts, and answers
 * `worldFactor` as the factor of its own attributes. A null factor draws at 1.
 *
 * @canonical The exposure a scene renders with
 */
export function useSceneExposure(factor: number | null, worldFactor: number | null): void {
  const scene = useThree((state) => state.scene);
  // A layout effect, so a render after the commit draws at the new factor.
  useLayoutEffect(() => {
    const entry: HeldExposure = { view: factor, world: worldFactor };
    const exposure = exposureOf(scene);
    exposure.held.push(entry);
    settleExposure(scene, exposure);
    return () => {
      exposure.held.splice(exposure.held.indexOf(entry), 1);
      settleExposure(scene, exposure);
    };
  }, [scene, factor, worldFactor]);
}
