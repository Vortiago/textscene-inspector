/**
 * Semantic lint checks shared by the AudioStreamPlayer family. The
 * extreme-volume / unusual-pitch bands were copy-pasted verbatim across the
 * 2D/3D/base `linter.ts` files (architecture review) — only the rule-name prefix
 * and the volume thresholds differed — so they are **Range advisory** arms now,
 * flowing through the shared `rangeAdvisories` combinator.
 *
 * Only ADVISORY bands live here. A condition the setter refuses outright
 * belongs on the property's validator in each slice's `linterParser.ts`, which
 * already carries the same `enforced:` citation and reports at the same tier;
 * a semantic rule beside it makes the linter report one value twice.
 *
 * `volume_db` and `pitch_scale` are declared on three SEPARATE concrete
 * classes (no shared base ADD_PROPERTY), so each player's citation is a
 * different `file:line` even where the band itself is identical text. A
 * single helper taking that citation as a parameter would hide it from
 * `rangeAdvisoryGrounding.test.ts`, whose source scrape can only see a
 * quoted citation written directly on the arm object, so each player gets
 * its own arm-building function instead (the shape
 * `lights/shared/linterChecks.ts` uses for `omniRangeArms` / `spotRangeArms`).
 */

import type { RangeArm } from '../../linter/rangeAdvisory.js';
import type { TscnNode, TscnScene } from '../../parser/types.js';
import { isValidProperties, resolveNodePathTarget } from '../../linter/linterUtils.js';
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
 * Resolution reuses `resolveNodePathTarget`'s confidence bar (final-segment
 * name match, scene-wide, refusing `..` and instance-scoped paths): a track
 * whose target can't be resolved confidently is treated as NOT driving this
 * node — a missed warning beats a wrong one.
 */
export function isDrivenByAnimationAudioTrack(scene: TscnScene, node: TscnNode): boolean {
  for (const player of collectByType(scene.nodes, 'AnimationPlayer')) {
    if (!isValidProperties(player.properties)) continue;
    const libraries = extractLibraries(player.properties as Record<string, string>);
    for (const rawPath of resolveAudioTrackPaths(libraries, scene.internalResources)) {
      const target = resolveNodePathTarget(scene.nodes, player, rawPath);
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
 * `volume_db`'s **Range advisory** for the plain AudioStreamPlayer.
 * audio_stream_player.cpp:282, PROPERTY_HINT_RANGE "-80,24,suffix:dB": both
 * ends closed. `set_volume_db` (audio_stream_player.cpp:69-71) only ERR_FAILs
 * on NaN, so the band is advisory rather than enforced. `rulePrefix` is the
 * node-type slug so each caller keeps its own `<prefix>-extreme-volume` rule
 * name.
 */
export function basePlayerVolumeArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: -80,
      ruleName: `${rulePrefix}-extreme-volume`,
      cite: 'audio_stream_player.cpp:282',
      message: (volumeDb) => `Volume is ${volumeDb} dB. The editor range starts at -80 dB.`,
    },
    {
      over: 24,
      ruleName: `${rulePrefix}-extreme-volume`,
      cite: 'audio_stream_player.cpp:282',
      message: (volumeDb) => `Volume is ${volumeDb} dB. The editor range stops at 24 dB.`,
    },
  ];
}

/**
 * `volume_db`'s **Range advisory** for AudioStreamPlayer2D. Same "-80,24"
 * band as the base player, but declared on its own `ADD_PROPERTY` line.
 * audio_stream_player_2d.cpp:430, PROPERTY_HINT_RANGE "-80,24,suffix:dB".
 * `set_volume_db` (audio_stream_player_2d.cpp:209-211) only ERR_FAILs on NaN.
 */
export function player2DVolumeArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: -80,
      ruleName: `${rulePrefix}-extreme-volume`,
      cite: 'audio_stream_player_2d.cpp:430',
      message: (volumeDb) => `Volume is ${volumeDb} dB. The editor range starts at -80 dB.`,
    },
    {
      over: 24,
      ruleName: `${rulePrefix}-extreme-volume`,
      cite: 'audio_stream_player_2d.cpp:430',
      message: (volumeDb) => `Volume is ${volumeDb} dB. The editor range stops at 24 dB.`,
    },
  ];
}

/**
 * `volume_db`'s **Range advisory** for AudioStreamPlayer3D: a wider band
 * (+80 dB, not +24) than the other two players.
 * audio_stream_player_3d.cpp:883, PROPERTY_HINT_RANGE "-80,80,suffix:dB".
 * `set_volume_db` (audio_stream_player_3d.cpp:552-554) only ERR_FAILs on NaN.
 */
export function player3DVolumeArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: -80,
      ruleName: `${rulePrefix}-extreme-volume`,
      cite: 'audio_stream_player_3d.cpp:883',
      message: (volumeDb) => `Volume is ${volumeDb} dB. The editor range starts at -80 dB.`,
    },
    {
      over: 80,
      ruleName: `${rulePrefix}-extreme-volume`,
      cite: 'audio_stream_player_3d.cpp:883',
      message: (volumeDb) => `Volume is ${volumeDb} dB. The editor range stops at 80 dB.`,
    },
  ];
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

