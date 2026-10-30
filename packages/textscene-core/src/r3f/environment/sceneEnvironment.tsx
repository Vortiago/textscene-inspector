/**
 * The Environment each scene shows, and the one a viewport pass or a probe capture draws it with.
 * Each part of an Environment, such as its background or its fog, writes the scene only while its
 * Environment is on the scene, so a pass through a camera with an Environment of its own draws that
 * one over a world whose scene shows another, as Godot forces it per render
 * (`renderer_scene_cull.cpp:3594-3597`).
 */

import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { perObject } from '../../utils/perObject';
import { drawAtExposure, worldExposureOfScene } from '../exposure/sceneExposure';

/** Writes one part of an Environment onto its scene, and answers the call that takes it off. */
export type EnvironmentPart = () => () => void;

/** The settings object that names an Environment. */
export type Environment = object;

interface PartOnScene {
  part: EnvironmentPart;
  takeOff: () => void;
}

interface SceneEnvironments {
  /** The Environment the scene shows outside a pass, written only by `showEnvironment`. */
  shown: Environment | null;
  /** The world's own Environment, which a probe captures with. Written only by `useOwnEnvironment`. */
  own: Environment | null;
  /**
   * Grows each time `own` or one of its parts changes, written by `useOwnEnvironment`,
   * `registerEnvironmentPart` and `noteEnvironmentChange`.
   */
  ownChanges: number;
  /** The Environment whose parts are on the scene now, written only by `putOn`. */
  applied: Environment | null;
  parts: Map<Environment, Set<EnvironmentPart>>;
  /** The parts on the scene, in the order they went on. */
  onScene: PartOnScene[];
}

const environmentsOf = perObject((_scene: THREE.Scene): SceneEnvironments => ({
  shown: null,
  own: null,
  ownChanges: 0,
  applied: null,
  parts: new Map(),
  onScene: [],
}));

/** Counts a change of `environment`, which a probe sees only for the world's own. */
function noteChangeOf(environments: SceneEnvironments, environment: Environment | null): void {
  if (environment !== null && environment === environments.own) environments.ownChanges += 1;
}

/** Takes the parts on the scene off, last first, then puts the parts of `environment` on. */
function putOn(environments: SceneEnvironments, environment: Environment | null): void {
  const { onScene } = environments;
  for (let index = onScene.length - 1; index >= 0; index -= 1) onScene[index]!.takeOff();
  onScene.length = 0;
  environments.applied = environment;
  if (environment === null) return;
  for (const part of environments.parts.get(environment) ?? []) onScene.push({ part, takeOff: part() });
}

/**
 * Has `part` of `environment` write `scene` whenever that Environment is on it, until the returned
 * function runs.
 *
 * @canonical A part of an Environment on its scene
 */
export function registerEnvironmentPart(
  scene: THREE.Scene,
  environment: Environment,
  part: EnvironmentPart
): () => void {
  const environments = environmentsOf(scene);
  const parts = environments.parts.get(environment) ?? new Set<EnvironmentPart>();
  environments.parts.set(environment, parts);
  parts.add(part);
  noteChangeOf(environments, environment);
  if (environments.applied === environment) environments.onScene.push({ part, takeOff: part() });
  return () => {
    parts.delete(part);
    if (parts.size === 0) environments.parts.delete(environment);
    noteChangeOf(environments, environment);
    const index = environments.onScene.findIndex((entry) => entry.part === part);
    if (index === -1) return;
    environments.onScene[index]!.takeOff();
    environments.onScene.splice(index, 1);
  };
}

/**
 * Counts a change of what a part of `environment` draws on `scene` that no registration shows, such
 * as a sky bake that lands a frame after the render that asked for it.
 *
 * @canonical A part of an Environment on its scene
 */
export function noteEnvironmentChange(scene: THREE.Scene, environment: Environment): void {
  noteChangeOf(environmentsOf(scene), environment);
}

/**
 * Shows `environment` on `scene` outside a pass, until the returned function runs. One world
 * shows one Environment on its scene.
 */
function showEnvironment(scene: THREE.Scene, environment: Environment): () => void {
  const environments = environmentsOf(scene);
  environments.shown = environment;
  putOn(environments, environment);
  return () => {
    if (environments.shown !== environment) return;
    environments.shown = null;
    putOn(environments, null);
  };
}

/** Runs `draw` with `environment` on `scene`, and puts the shown one back after it. */
function drawWithEnvironment<T>(scene: THREE.Scene, environment: Environment | null, draw: () => T): T {
  const environments = environmentsOf(scene);
  if (environment === environments.applied) return draw();
  try {
    putOn(environments, environment);
    return draw();
  } finally {
    putOn(environments, environments.shown);
  }
}

/**
 * Runs `draw` with `scene` set for `environment` at `exposure`, and puts the scene back after it. A
 * draw with what the scene holds changes nothing. The Environment goes on first, since its parts
 * register the exposure stages the draw runs.
 *
 * @canonical The Environment and the exposure a draw of a scene takes
 */
export function drawWith<T>(
  scene: THREE.Scene,
  environment: Environment | null,
  exposure: number | null,
  draw: () => T
): T {
  return drawWithEnvironment(scene, environment, () => drawAtExposure(scene, exposure, draw));
}

/**
 * Runs `draw` with the world's own Environment and exposure on `scene`, as Godot captures a
 * reflection probe with the scenario's and not the camera's (`renderer_scene_cull.cpp:3692`).
 *
 * @canonical The Environment and the exposure a draw of a scene takes
 */
export function drawAsWorld<T>(scene: THREE.Scene, draw: () => T): T {
  return drawWith(scene, environmentsOf(scene).own, worldExposureOfScene(scene), draw);
}

/**
 * A count that grows each time the world's own Environment on `scene`, or one of its parts,
 * changes, so a probe captures again only for a change it would capture.
 *
 * @canonical The Environment and the exposure a draw of a scene takes
 */
export function ownEnvironmentChanges(scene: THREE.Scene): number {
  return environmentsOf(scene).ownChanges;
}

/**
 * Names `environment` the own Environment of the world whose scene the caller draws in, null for
 * none. One world names one on its scene.
 *
 * @canonical The Environment and the exposure a draw of a scene takes
 */
export function useOwnEnvironment(environment: Environment | null): void {
  const scene = useThree((state) => state.scene);
  useLayoutEffect(() => {
    const environments = environmentsOf(scene);
    environments.own = environment;
    noteChangeOf(environments, environment);
    return () => {
      if (environments.own !== environment) return;
      noteChangeOf(environments, environment);
      environments.own = null;
    };
  }, [scene, environment]);
}

/** The Environment the parts below belong to, null outside one. */
const EnvironmentKeyContext = createContext<Environment | null>(null);

/**
 * The Environment the calling part belongs to.
 *
 * @canonical A part of an Environment on its scene
 */
export function useEnvironmentKey(): Environment {
  const environment = useContext(EnvironmentKeyContext);
  if (!environment) throw new Error('expected an Environment around an Environment part, found none');
  return environment;
}

/**
 * Mounts the parts of `environment` below, which its scene shows outside a pass.
 *
 * @canonical A part of an Environment on its scene
 */
export function ShownEnvironment({
  environment,
  children,
}: {
  environment: Environment;
  children: ReactNode;
}) {
  const scene = useThree((state) => state.scene);
  // A layout effect, so the scene shows the Environment before a part's effect registers.
  useLayoutEffect(() => showEnvironment(scene, environment), [scene, environment]);
  return <DrawnEnvironment environment={environment}>{children}</DrawnEnvironment>;
}

/**
 * Mounts the parts of `environment` below, which its scene shows only while a pass draws with it.
 *
 * @canonical A part of an Environment on its scene
 */
export function DrawnEnvironment({
  environment,
  children,
}: {
  environment: Environment;
  children: ReactNode;
}) {
  return <EnvironmentKeyContext.Provider value={environment}>{children}</EnvironmentKeyContext.Provider>;
}
