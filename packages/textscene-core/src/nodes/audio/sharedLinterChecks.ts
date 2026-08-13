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
import { resolveNodePath } from '../../linter/nodePathResolve.js';
import { extractLibraries } from '../animation/animationplayer/parser.js';
import { resolveAudioTrackPaths } from '../animation/animationplayer/animationResolver.js';

/**
 * True when some AnimationPlayer anywhere in the scene drives `node` through
 * an `audio` track — `animation_mixer.cpp:889-897` builds a separate
 * polyphonic playback bound to the track's target and never reads that
 * node's own `stream` property, so such a node is not silent even with no
 * `stream` of its own. The `missing-stream` / `autoplay-without-stream`
 * rules must stay quiet about it.
 *
 * Track paths resolve from the mixer's `root_node`, NOT from the player:
 * `_update_caches` takes `Node *parent = get_node_or_null(root_node)`
 * (animation_mixer.cpp:661) and walks every track path from there, and
 * `root_node` defaults to `NodePath("..")` (scene_string_names.h:129), the
 * player's own parent. Resolving from the player instead shifts every track one
 * level down the tree.
 *
 * A target that cannot be resolved confidently is treated as NOT driving this
 * node — a missed warning beats a wrong one.
 */
export function isDrivenByAnimationAudioTrack(scene: TscnScene, node: TscnNode): boolean {
  for (const player of collectByType(scene.nodes, 'AnimationPlayer')) {
    if (!isValidProperties(player.properties)) continue;
    const props = player.properties as Record<string, string>;
    // `root_node` defaults to ".." only when the key is ABSENT. An authored
    // `NodePath("")` is a different state: `get_node_or_null` fails on
    // `p_path.is_empty()` (node.cpp:1894), `_update_caches` bails on the null
    // parent (animation_mixer.cpp:661), and the player drives nothing — so
    // substituting the default there would suppress a warning that is correct.
    const rootPath =
      props.root_node === undefined ? '..' : extractNodePath(props.root_node);
    if (rootPath === null) continue;
    const mixerRoot = resolveNodePath(scene, player, rootPath);
    if (mixerRoot.status !== 'found') continue;

    const libraries = extractLibraries(props);
    for (const rawPath of resolveAudioTrackPaths(libraries, scene.internalResources)) {
      const target = resolveNodePath(scene, mixerRoot.node, rawPath);
      if (target.status === 'found' && target.node === node) return true;
    }
  }
  return false;
}

/** Every node of `type` anywhere in the scene tree (depth-first). */
function collectByType(nodes: readonly TscnNode[], type: string): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (list: readonly TscnNode[]): void => {
    for (const n of list) {
      if (n.type === type) out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}


