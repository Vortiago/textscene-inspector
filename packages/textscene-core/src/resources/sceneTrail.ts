/**
 * Follows the part of an id trail that lies in a loaded scene: the headings the scene kept, and the
 * scenes its instances and its base name, read through the scene cache. Godot walks the same states
 * (`SceneState::_recover_node_path_index`, `packed_scene.cpp:1947-2005`).
 */

import type { SceneScope, TscnNode } from '../parser/types';
import { sceneHeadings } from '../parser/sceneTreeBuilder';
import { firstIndexWith } from '../utils/keyedLookup';
import { resolveInstancePath } from './SubResourceResolver';
import {
  followContentTrail,
  type SceneLookup,
  type TrailHeading,
  type TrailScene,
  type TrailWalk,
} from '../godot/scene/packedScene';

/** A loaded scene as the trail reads it: its nodes, which key its headings, and its ExtResource pool. */
type LoadedScene = Partial<Pick<SceneScope, 'externalResources'>> & { readonly nodes: readonly TscnNode[] };

/** The loader's scene cache: `undefined` for a scene never requested, `null` for one that failed. */
interface SceneReads {
  getCached: (path: string) => LoadedScene | null | undefined;
}

/** Follows the rest of an id trail in the scene an instance holds, as {@link followContentTrail} does. */
export type FollowTrail = (trail: readonly number[]) => TrailWalk;

/** The follower for a caller that knows no scene: every trail waits for one. */
export const WAITING_FOR_SCENES: FollowTrail = () => ({ status: 'pending' });

const firstIndexWithId = firstIndexWith((heading: TrailHeading) => heading.uniqueId);

/** Follows a trail over `scene` and the scenes its instances and bases name, read through `scenes`. */
export function followTrailIn(scene: LoadedScene, scenes: SceneReads): FollowTrail {
  return (trail) => followContentTrail(trail, trailSceneOf(scene, scenes, []));
}

/**
 * `scene` as a trail reads it. `baseChain` is the paths of the bases read to get here, so a base that
 * inherits itself (cyclic inheritance, which Godot's loader refuses) ends the search.
 */
function trailSceneOf(scene: LoadedScene, scenes: SceneReads, baseChain: readonly string[]): TrailScene {
  const headings = sceneHeadings(scene.nodes);
  const lookup = (ref: string | undefined, chain: readonly string[] = []): SceneLookup => {
    const path = ref === undefined ? null : resolveInstancePath(ref, scene.externalResources ?? []);
    if (path === null || chain.includes(path)) return 'missing';
    const loaded = scenes.getCached(path);
    if (loaded === undefined) return 'pending';
    return loaded === null ? 'missing' : trailSceneOf(loaded, scenes, [...chain, path]);
  };
  return {
    indexWithId: (id) => firstIndexWithId(headings, id),
    headingAt: (index) => headings[index]!,
    instancedScene: (index) => lookup(headings[index]!.instanceRef),
    baseScene: () => {
      const root = headings[0];
      return root?.instance === 'scene' ? lookup(root.instanceRef, baseChain) : undefined;
    },
  };
}
