/**
 * Semantic lint checks shared by the AudioStreamPlayer family. The
 * extreme-volume / unusual-pitch bands were copy-pasted verbatim across the
 * 2D/3D/base `linter.ts` files (architecture review) — only the rule-name prefix
 * and the volume thresholds differed — so they are **Range advisory** arms now,
 * flowing through the shared `rangeAdvisories` combinator. `max_polyphony` stays
 * a hand-written check because it is an ERROR, not an advisory.
 */

import type { Diagnostic } from '../../linter/types.js';
import type { RangeArm } from '../../linter/rangeAdvisory.js';

/**
 * Bottom of the `pitch_scale` hint, audio_stream_player.cpp:284 (and the
 * identical lines in the 2D/3D players) — PROPERTY_HINT_RANGE
 * "0.01,4,0.01,or_greater". The top end is open, so only the bottom is advisory.
 */
const PITCH_SCALE_HINT_MIN = 0.01;

/**
 * The two `volume_db` **Range advisory** arms — outside the dB range the
 * inspector offers. The bounds differ per node type (the 3D player's hint runs
 * to +80 dB where the others stop at +24), so the caller passes them.
 * `rulePrefix` is the node-type slug so each slice keeps its own
 * `<prefix>-extreme-volume` rule name.
 */
export function extremeVolumeArms(
  rulePrefix: string,
  volumeDbMin: number,
  volumeDbMax: number
): RangeArm[] {
  return [
    {
      under: volumeDbMin,
      ruleName: `${rulePrefix}-extreme-volume`,
      message: (volumeDb) =>
        `Volume is ${volumeDb} dB. The editor range starts at ${volumeDbMin} dB.`,
    },
    {
      over: volumeDbMax,
      ruleName: `${rulePrefix}-extreme-volume`,
      message: (volumeDb) =>
        `Volume is ${volumeDb} dB. The editor range stops at ${volumeDbMax} dB.`,
    },
  ];
}

/**
 * The `pitch_scale` **Range advisory** — a POSITIVE pitch below the bottom of
 * the hint (`<prefix>-unusual-pitch`). The top of the hint is `or_greater`, so
 * there is no high arm, and the `floor: 0` keeps non-positive values with the
 * slice's own error (the setter refuses them outright).
 */
export function unusualPitchArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: PITCH_SCALE_HINT_MIN,
      floor: 0,
      ruleName: `${rulePrefix}-unusual-pitch`,
      message: (pitchScale) =>
        `Pitch scale is ${pitchScale}. The editor range starts at ${PITCH_SCALE_HINT_MIN}.`,
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
