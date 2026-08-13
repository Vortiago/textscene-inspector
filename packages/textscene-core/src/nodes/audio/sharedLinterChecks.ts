/**
 * Semantic lint checks shared by the AudioStreamPlayer family. The
 * unusual-pitch band was copy-pasted verbatim across the 2D/3D `linter.ts`
 * files (architecture review) — only the rule-name prefix differed — so it is a
 * **Range advisory** arm now, flowing through the shared `rangeAdvisories`
 * combinator.
 *
 * Only the band a validator CANNOT state lives here. `pitch_scale`'s does not
 * fit one: `min` already holds the setter's enforced `> 0` refusal, and the
 * hint's higher 0.01 floor is a second, milder end the slot cannot carry. Every
 * other hint bound is on the property's validator in each slice's
 * `linterParser.ts` — a rule beside a bound makes the linter report one value
 * twice.
 *
 * `pitch_scale` is declared on three SEPARATE concrete classes (no shared base
 * ADD_PROPERTY), so each player's citation is a different `file:line` even
 * though the hint text is identical. A single helper taking that citation as a
 * parameter would hide it from `rangeAdvisoryGrounding.test.ts`, whose source
 * scrape can only see a quoted citation written directly on the arm object, so
 * each player gets its own arm-building function instead (the shape
 * `lights/shared/linterChecks.ts` uses for `omniRangeArms` / `spotRangeArms`).
 */

import type { RangeArm } from '../../linter/rangeAdvisory.js';
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

/**
 * `pitch_scale`'s **Range advisory** for AudioStreamPlayer2D: a POSITIVE
 * pitch below the bottom of the hint. `floor: 0` keeps non-positive values
 * with the slice's own error (the setter refuses them outright). The hint
 * text is identical across all three players ("0.01,4,0.01,or_greater"), but
 * each concrete class declares its own line, so this gets its own citation.
 * audio_stream_player_2d.cpp:432, PROPERTY_HINT_RANGE "0.01,4,0.01,or_greater".
 */
export function player2DPitchArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: 0.01,
      floor: 0,
      ruleName: `${rulePrefix}-unusual-pitch`,
      cite: 'audio_stream_player_2d.cpp:432',
      message: (pitchScale) => `Pitch scale is ${pitchScale}. The editor range starts at 0.01.`,
    },
  ];
}

/**
 * `pitch_scale`'s **Range advisory** for AudioStreamPlayer3D. Same band as
 * `player2DPitchArms`, own citation line.
 * audio_stream_player_3d.cpp:887, PROPERTY_HINT_RANGE "0.01,4,0.01,or_greater".
 */
export function player3DPitchArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: 0.01,
      floor: 0,
      ruleName: `${rulePrefix}-unusual-pitch`,
      cite: 'audio_stream_player_3d.cpp:887',
      message: (pitchScale) => `Pitch scale is ${pitchScale}. The editor range starts at 0.01.`,
    },
  ];
}

