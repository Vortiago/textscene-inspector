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

const TYPICAL_PITCH_SCALE_MIN = 0.5;
const TYPICAL_PITCH_SCALE_MAX = 2.0;

/**
 * The two `volume_db` **Range advisory** arms — implausibly low or high.
 * Thresholds differ per node type (2D/base tolerate a wider range than 3D), so
 * the caller passes them. `rulePrefix` is the node-type slug so each slice keeps
 * its own `<prefix>-extreme-volume` rule name.
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
        `Volume is very low (${volumeDb} dB). Values below ${volumeDbMin} dB are rarely intentional.`,
    },
    {
      over: volumeDbMax,
      ruleName: `${rulePrefix}-extreme-volume`,
      message: (volumeDb) =>
        `Volume is very high (${volumeDb} dB). Values above ${volumeDbMax} dB can cause distortion.`,
    },
  ];
}

/**
 * The two `pitch_scale` **Range advisory** arms — a POSITIVE pitch outside the
 * typical 0.5–2.0 range (`<prefix>-unusual-pitch`). The `floor: 0` on the low arm
 * keeps non-positive values the slice's own (error-level) concern.
 */
export function unusualPitchArms(rulePrefix: string): RangeArm[] {
  return [
    {
      under: TYPICAL_PITCH_SCALE_MIN,
      floor: 0,
      ruleName: `${rulePrefix}-unusual-pitch`,
      message: (pitchScale) =>
        `Pitch scale is very low (${pitchScale}). Values below ${TYPICAL_PITCH_SCALE_MIN} sound very slow/deep.`,
    },
    {
      over: TYPICAL_PITCH_SCALE_MAX,
      ruleName: `${rulePrefix}-unusual-pitch`,
      message: (pitchScale) =>
        `Pitch scale is very high (${pitchScale}). Values above ${TYPICAL_PITCH_SCALE_MAX} sound very fast/high-pitched.`,
    },
  ];
}

/** Error when `max_polyphony` parses below 1 (`<prefix>-invalid-max-polyphony`). */
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
