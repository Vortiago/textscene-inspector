/** Builds and reads the live scene tree, for tests over a main scene and the scenes it instances. */
import type { TscnNode, TscnScene } from '../parser/types';
import { resolveLiveEntry, type LiveTreeContext } from './liveSceneTree';

/** The collapsed node at `path`, or null when a segment does not resolve. */
export function liveNodeAt(path: string, roots: readonly TscnNode[], ctx: LiveTreeContext) {
  return resolveLiveEntry(path, roots, ctx)?.node ?? null;
}

/**
 * The context of `main`, with each scene path in `scenes` cached and every other path not.
 *
 * @oneWay In tests, a live-tree context over scenes
 */
export function contextOver(main: TscnScene, scenes: Record<string, TscnScene>): LiveTreeContext {
  return {
    externalResources: main.externalResources,
    internalResources: main.internalResources,
    sceneCache: { getCached: (path) => scenes[path] },
  };
}
