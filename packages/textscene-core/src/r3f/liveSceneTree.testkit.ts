/** Builds and reads the live scene tree, for tests over a main scene and the scenes it instances. */
import type * as THREE from 'three';
import { TscnParser } from '../parser/TscnParser';
import type { TscnNode, TscnScene } from '../parser/types';
import {
  LiveTree,
  liveTreeOf,
  resolveLiveEntry,
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

/** The path of every node of `main`'s live tree, with each scene in `scenes` cached. */
export function livePathsOver(main: TscnScene, scenes: Readonly<Record<string, TscnScene>>): string[] {
  return livePathsOf(liveTreeOf(main.nodes, contextOver(main, scenes)));
}

/**
 * The path of every node of `tree`, parents before children.
 *
 * @canonical In tests, the path of every node of a live tree
 */
export function livePathsOf(tree: LiveTree): string[] {
  const paths: string[] = [];
  tree.fold(undefined, ({ path }, _, descend) => {
    paths.push(path);
    descend(undefined);
  });
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

/** A scene file with two parentless headings, which Godot refuses to instantiate (`packed_scene.cpp:207`). */
export const TWO_PARENTLESS_ROOTS = `[gd_scene format=3]

[node name="One" type="Node3D"]

[node name="Two" type="Node3D"]
`;

/** A scene file with a node `Main`, whose child `Body` instances `scenePath` and has one child, `Mark`. */
export function mainInstancing(scenePath: string): string {
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="${scenePath}" id="1"]

[node name="Main" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("1")]

[node name="Mark" type="Node3D" parent="Body"]
`;
}
