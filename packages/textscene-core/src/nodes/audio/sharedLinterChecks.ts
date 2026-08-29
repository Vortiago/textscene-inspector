/**
 * Semantic lint checks shared by the AudioStreamPlayer family: the checks that
 * need the whole scene tree, which no per-property validator can see.
 *
 * Hint bands are NOT here. Every one of them lives on the property's validator
 * in each slice's `linterParser.ts`, which carries the setter's floor and the
 * hint's as separate ends — a rule beside a bound makes the linter report one
 * value twice.
 */

import type { TscnNode, TscnScene } from '../../parser/types.js';
import { extractNodePath, isValidProperties } from '../../linter/linterUtils.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { resolveNodePath } from '../../linter/nodePathResolve.js';
import { extractLibraries } from '../animation/animationplayer/parser.js';
import { resolveAudioTrackPaths } from '../animation/animationplayer/animationResolver.js';

/**
 * True when some AnimationMixer anywhere in the scene drives `node` through
 * an `audio` track — `animation_mixer.cpp:891-898` builds a separate
 * polyphonic playback bound to the track's target and never reads that
 * node's own `stream` property, so such a node is not silent even with no
 * `stream` of its own. The `missing-stream` / `autoplay-without-stream`
 * rules must stay quiet about it.
 *
 * The whole chain, not `AnimationPlayer` by name: `_update_caches`, `libraries`
 * and `root_node` are all AnimationMixer's, so an AnimationTree drives an audio
 * track exactly as a player does and an exact-type test left the warning firing
 * on a node the engine does feed.
 *
 * Track paths resolve from the mixer's `root_node`, NOT from the mixer node:
 * `_update_caches` takes `Node *parent = get_node_or_null(root_node)`
 * (animation_mixer.cpp:661) and walks every track path from there, and
 * `root_node` defaults to `NodePath("..")` (scene_string_names.h:129), the
 * mixer's own parent. Resolving from the mixer instead shifts every track one
 * level down the tree.
 *
 * A target that cannot be resolved confidently is treated as NOT driving this
 * node — a missed warning beats a wrong one.
 */
export function isDrivenByAnimationAudioTrack(scene: TscnScene, node: TscnNode): boolean {
  for (const mixer of collectMixers(scene.nodes)) {
    if (!isValidProperties(mixer.properties)) continue;
    const props = mixer.properties as Record<string, string>;
    // `root_node` defaults to ".." only when the key is ABSENT. An authored
    // `NodePath("")` is a different state: `get_node_or_null` fails on
    // `p_path.is_empty()` (node.cpp:1894), `_update_caches` bails on the null
    // parent (animation_mixer.cpp:661), and the mixer drives nothing — so
    // substituting the default there would suppress a warning that is correct.
    const rootPath =
      props.root_node === undefined ? '..' : extractNodePath(props.root_node);
    if (rootPath === null) continue;
    const mixerRoot = resolveNodePath(scene, mixer, rootPath);
    if (mixerRoot.status !== 'found') continue;

    const libraries = extractLibraries(props);
    for (const rawPath of resolveAudioTrackPaths(libraries, scene.internalResources)) {
      const target = resolveNodePath(scene, mixerRoot.node, rawPath);
      if (target.status === 'found' && target.node === node) return true;
    }
  }
  return false;
}

/** Every AnimationMixer heir anywhere in the scene tree (depth-first). */
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


