/**
 * Semantic lint checks shared by the AudioStreamPlayer family that need the whole scene tree. Hint
 * bands live on each slice's validators in `linterParser.ts`, since a rule beside a bound would
 * report one value twice.
 */

import type { TscnNode, TscnScene } from '../../parser/types.js';
import { extractNodePath, isValidProperties } from '../../linter/linterUtils.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { resolveNodePath } from '../../linter/nodePathResolve.js';
import { extractLibraries } from '../animation/animationplayer/parser.js';
import { resolveAudioTrackPaths } from '../animation/animationplayer/animationResolver.js';

/**
 * True when an AnimationMixer in the scene drives `node` through an `audio` track:
 * `animation_mixer.cpp:891-898` builds a separate polyphonic playback for the track's target and
 * never reads its `stream`, so `missing-stream` and `autoplay-without-stream` stay quiet. A target
 * that cannot be resolved confidently counts as not driven: a missed warning beats a wrong one.
 */
export function isDrivenByAnimationAudioTrack(scene: TscnScene, node: TscnNode): boolean {
  for (const mixer of collectMixers(scene.nodes)) {
    if (!isValidProperties(mixer.properties)) continue;
    const props = mixer.properties as Record<string, string>;
    // `root_node` defaults to `NodePath("..")` (scene_string_names.h:129), the mixer's parent,
    // only when the key is absent. An authored `NodePath("")` fails `get_node_or_null`
    // (node.cpp:1894), so `_update_caches` bails on the null parent and the mixer drives nothing.
    const rootPath =
      props.root_node === undefined ? '..' : extractNodePath(props.root_node);
    if (rootPath === null) continue;
    const mixerRoot = resolveNodePath(scene, mixer, rootPath);
    if (mixerRoot.status !== 'found') continue;

    const libraries = extractLibraries(props);
    // Track paths resolve from the mixer's `root_node`, not the mixer: `_update_caches` walks them
    // from `get_node_or_null(root_node)` (animation_mixer.cpp:661).
    for (const rawPath of resolveAudioTrackPaths(libraries, scene.internalResources)) {
      const target = resolveNodePath(scene, mixerRoot.node, rawPath);
      if (target.status === 'found' && target.node === node) return true;
    }
  }
  return false;
}

/**
 * Every AnimationMixer heir in the scene tree (depth-first). The whole chain, not AnimationPlayer
 * by name: `_update_caches`, `libraries` and `root_node` are AnimationMixer's, so an AnimationTree
 * drives an audio track as a player does.
 */
function collectMixers(nodes: readonly TscnNode[]): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (list: readonly TscnNode[]): void => {
    for (const n of list) {
      if (descendsFrom(n.type, 'AnimationMixer')) out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}


