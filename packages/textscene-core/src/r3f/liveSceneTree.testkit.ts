/** Builds and reads the live scene tree, for tests over a main scene and the scenes it instances. */
import type * as THREE from 'three';
import type { TscnNode, TscnScene } from '../parser/types';
import { resolveLiveEntry, type CachedSceneSource, type LiveTreeContext } from './liveSceneTree';

/** The collapsed node at `path`, or null when a segment does not resolve. */
export function liveNodeAt(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext) {
  return resolveLiveEntry(path, roots, ctx)?.node ?? null;
}

/**
 * A scene cache that holds each scene path in `scenes` and no other path.
 *
 * @canonical In tests, a scene cache over scenes
 */
export function sceneCacheOver(scenes: Readonly<Record<string, TscnScene>>): CachedSceneSource {
  return { getCached: (path) => scenes[path] };
}

/**
 * The context of `main`'s pools, with each scene path in `scenes` and each GLB path in `glbs`
 * cached and every other path not.
 *
 * @canonical In tests, a live-tree context over scenes
 */
export function contextOver(
  main: Pick<TscnScene, 'externalResources' | 'internalResources'>,
  scenes: Readonly<Record<string, TscnScene>>,
  glbs?: Readonly<Record<string, THREE.Object3D>>
): LiveTreeContext {
  return {
    externalResources: main.externalResources,
    internalResources: main.internalResources,
    sceneCache: sceneCacheOver(scenes),
    ...(glbs ? { glbCache: { getCached: (path: string) => glbs[path] } } : {}),
  };
}
