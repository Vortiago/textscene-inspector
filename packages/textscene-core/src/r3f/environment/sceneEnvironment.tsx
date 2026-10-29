/**
 * The Environment each scene shows, and the one a viewport pass draws it with. Each part of an
 * Environment, such as its background or its fog, writes the scene only while its Environment is
 * on the scene, so a pass through a camera with an Environment of its own draws that one over a
 * world whose scene shows another, as Godot forces it per render (`renderer_scene_cull.cpp:3594-3597`).
 */

import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { perObject } from '../../utils/perObject';

/** Writes one part of an Environment onto its scene, and answers the call that takes it off. */
export type EnvironmentPart = () => () => void;

/** The settings object that names an Environment, or null for none. */
export type EnvironmentKey = object | null;

interface SceneEnvironments {
  /** The Environment the scene shows outside a pass, written only by `showEnvironment`. */
  shown: EnvironmentKey;
  /** The Environment whose parts are on the scene now, written only by `putOn`. */
  applied: EnvironmentKey;
  parts: Map<object, Set<EnvironmentPart>>;
  /** The take-off of each part on the scene, in the order they went on. */
  takeOffs: Map<EnvironmentPart, () => void>;
}

const environmentsOf = perObject((_scene: THREE.Scene): SceneEnvironments => ({
  shown: null,
  applied: null,
  parts: new Map(),
  takeOffs: new Map(),
}));

/** Takes the parts on the scene off, last first, then puts the parts of `environment` on. */
function putOn(environments: SceneEnvironments, environment: EnvironmentKey): void {
  for (const takeOff of [...environments.takeOffs.values()].reverse()) takeOff();
  environments.takeOffs.clear();
  environments.applied = environment;
  if (environment === null) return;
  for (const part of environments.parts.get(environment) ?? []) environments.takeOffs.set(part, part());
}

/**
 * Has `part` of `environment` write `scene` whenever that Environment is on it, until the returned
 * function runs.
 *
 * @canonical A part of an Environment on its scene
 */
export function registerEnvironmentPart(
  scene: THREE.Scene,
  environment: object,
  part: EnvironmentPart
): () => void {
  const environments = environmentsOf(scene);
  const parts = environments.parts.get(environment) ?? new Set<EnvironmentPart>();
  environments.parts.set(environment, parts);
  parts.add(part);
  if (environments.applied === environment) environments.takeOffs.set(part, part());
  return () => {
    parts.delete(part);
    if (parts.size === 0) environments.parts.delete(environment);
    environments.takeOffs.get(part)?.();
    environments.takeOffs.delete(part);
  };
}

/**
 * Shows `environment` on `scene` outside a pass, until the returned function runs. One world
 * shows one Environment on its scene.
 */
function showEnvironment(scene: THREE.Scene, environment: object): () => void {
  const environments = environmentsOf(scene);
  environments.shown = environment;
  putOn(environments, environment);
  return () => {
    if (environments.shown !== environment) return;
    environments.shown = null;
    putOn(environments, null);
  };
}

/**
 * Runs `draw` with `environment` on `scene`, and puts the shown one back after it. A draw with the
 * shown Environment changes nothing.
 *
 * @canonical A part of an Environment on its scene
 */
export function drawWithEnvironment<T>(scene: THREE.Scene, environment: EnvironmentKey, draw: () => T): T {
  const environments = environmentsOf(scene);
  if (environment === environments.applied) return draw();
  try {
    putOn(environments, environment);
    return draw();
  } finally {
    putOn(environments, environments.shown);
  }
}

/** The Environment the parts below belong to, null outside one. */
const EnvironmentKeyContext = createContext<object | null>(null);

/**
 * The Environment the calling part belongs to.
 *
 * @canonical A part of an Environment on its scene
 */
export function useEnvironmentKey(): object {
  const environment = useContext(EnvironmentKeyContext);
  if (!environment) throw new Error('expected an Environment around an Environment part, found none');
  return environment;
}

/**
 * Mounts the parts of `environment` below, which its scene shows outside a pass.
 *
 * @canonical A part of an Environment on its scene
 */
export function ShownEnvironment({ environment, children }: { environment: object; children: ReactNode }) {
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
export function DrawnEnvironment({ environment, children }: { environment: object; children: ReactNode }) {
  return <EnvironmentKeyContext.Provider value={environment}>{children}</EnvironmentKeyContext.Provider>;
}
