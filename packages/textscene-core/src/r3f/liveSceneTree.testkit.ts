/** Builds and reads the live scene tree, for tests over a main scene and the scenes it instances. */
import type * as THREE from 'three';
import { TscnParser } from '../parser/TscnParser';
import type { TscnNode, TscnScene } from '../parser/types';
import {
  LiveTree,
  liveTreeOf,
  resolveLiveEntry,
  walkLiveTree,
  type CachedGlbSource,
  type CachedSceneSource,
  type LiveStep,
  type LiveTreeContext,
  type SceneScope,
} from './liveSceneTree';

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

/**
 * The path of every node of `main`'s live tree, with each scene in `scenes` cached.
 *
 * @canonical In tests, the path of every node of a live tree
 */
export function livePathsOver(main: TscnScene, scenes: Readonly<Record<string, TscnScene>>): string[] {
  const paths: string[] = [];
  walkLiveTree(main.nodes, contextOver(main, scenes), ({ path }) => paths.push(path));
  return paths;
}

/**
 * The step of `node` where it sits in a group of scope `scope`, over `sceneCache` and `glbCache`. A tree of
 * its own takes it, so a test that changes a cache in place asks again.
 *
 * @canonical In tests, the step of one node over caches
 */
export function stepOver(
  node: TscnNode,
  scope: SceneScope,
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): LiveStep {
  const ctx: LiveTreeContext = {
    externalResources: scope.externalResources,
    internalResources: scope.internalResources,
    sceneCache,
    ...(glbCache ? { glbCache } : {}),
  };
  return new LiveTree([], ctx).stepOf(node, scope);
}

/**
 * The live tree of the scene text `content`, with each scene text of `scenes` loaded at its path.
 *
 * @canonical In tests, a live tree over scene text
 */
export function liveTreeOfText(content: string, scenes: Readonly<Record<string, string>> = {}): LiveTree {
  const parse = (text: string) => new TscnParser().parse(text);
  const main = parse(content);
  const loaded = Object.fromEntries(Object.entries(scenes).map(([path, text]) => [path, parse(text)]));
  return liveTreeOf(main.nodes, contextOver(main, loaded));
}
