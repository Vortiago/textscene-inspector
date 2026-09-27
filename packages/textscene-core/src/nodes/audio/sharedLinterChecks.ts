/**
 * Semantic lint checks shared by the AudioStreamPlayer family that need the whole scene tree. Hint
 * bands live on each slice's validators in `linterParser.ts`, since a rule beside a bound would
 * report one value twice.
 */

import type { TscnInternalResource, TscnNode, TscnScene } from '../../parser/types.js';
import {
  extractNodePath,
  isValidProperties,
  nodesDescendingFrom,
} from '../../linter/linterUtils.js';
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
  return audioTrackTargets(scene).has(node);
}

/**
 * Keyed by the roots array, beside the resource table the tracks were read from: the answer reads
 * the tree and the animations and nothing else. Written only by `audioTrackTargets`. A rule asks
 * once per player, and a resolution per call repeats every animation parse.
 */
const audioTargetsByTree = new WeakMap<
  TscnNode[],
  { internalResources: readonly TscnInternalResource[]; targets: ReadonlySet<TscnNode> }
>();

function audioTrackTargets(scene: TscnScene): ReadonlySet<TscnNode> {
  const cached = audioTargetsByTree.get(scene.nodes);
  if (cached && cached.internalResources === scene.internalResources) return cached.targets;
  const targets = resolveAudioTrackTargets(scene);
  audioTargetsByTree.set(scene.nodes, { internalResources: scene.internalResources, targets });
  return targets;
}

/**
 * Every node some mixer's audio track resolves to. Every AnimationMixer heir counts, not
 * AnimationPlayer by name: `_update_caches`, `libraries` and `root_node` are AnimationMixer's, so
 * an AnimationTree drives an audio track as a player does.
 */
function resolveAudioTrackTargets(scene: TscnScene): Set<TscnNode> {
  const targets = new Set<TscnNode>();
  for (const mixer of nodesDescendingFrom(scene.nodes, 'AnimationMixer')) {
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
      if (target.status === 'found') targets.add(target.node);
    }
  }
  return targets;
}
