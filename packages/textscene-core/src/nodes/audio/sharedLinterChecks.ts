/**
 * Semantic lint checks shared by the AudioStreamPlayer family. The
 * extreme-volume / unusual-pitch bands were copy-pasted verbatim across the
 * 2D/3D/base `linter.ts` files (architecture review) — only the rule-name prefix
 * and the volume thresholds differed — so they are **Range advisory** arms now,
 * flowing through the shared `rangeAdvisories` combinator. `max_polyphony` stays
 * a hand-written check because it is an ERROR, not an advisory.
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

import type { Diagnostic } from '../../linter/types.js';
import type { RangeArm } from '../../linter/rangeAdvisory.js';

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

/**
 * Error when `max_polyphony` parses below 1 (`<prefix>-invalid-max-polyphony`).
 * `AudioStreamPlayerInternal::set_max_polyphony` (audio_stream_player_internal.cpp:322)
 * wraps the assignment in `if (p_max_polyphony > 0)`, so a value below 1 is
 * silently dropped and the node keeps its old polyphony: the engine refuses the
 * write, which is what makes this an error rather than an advisory. The property
 * itself is PROPERTY_HINT_NONE, so there is no hint band around it.
 */
export function checkInvalidMaxPolyphony(
  rawProps: Record<string, string>,
  nodeName: string,
  nodeType: string,
  rulePrefix: string,
  diagnostics: Diagnostic[]
): void {
  if (rawProps.max_polyphony === undefined) return;
  const maxPolyphony = parseInt(rawProps.max_polyphony, 10);
  if (Number.isNaN(maxPolyphony) || maxPolyphony >= 1) return;

  diagnostics.push({
    severity: 'error',
    message: `Property 'max_polyphony' must be at least 1 (got ${maxPolyphony}). Values below 1 cause runtime errors.`,
    nodeName,
    nodeType,
    ruleName: `${rulePrefix}-invalid-max-polyphony`,
  });
}
