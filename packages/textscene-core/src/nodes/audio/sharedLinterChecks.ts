/**
 * Semantic lint checks shared by the AudioStreamPlayer family. Extracted because
 * the extreme-volume / unusual-pitch / max_polyphony blocks were copy-pasted
 * verbatim across the 2D/3D/base `linter.ts` files (architecture review) — only
 * the rule-name prefix and the volume thresholds differed.
 */

import type { Diagnostic } from '../../linter/types.js';

const TYPICAL_PITCH_SCALE_MIN = 0.5;
const TYPICAL_PITCH_SCALE_MAX = 2.0;

/**
 * Warn when `volume_db` is implausibly low or high. Thresholds differ per node
 * type (2D/base tolerate a wider range than 3D), so the caller passes them.
 * `rulePrefix` is the node-type slug (e.g. 'audiostreamplayer2d') so each slice
 * keeps its own rule name (`<prefix>-extreme-volume`). Pushes onto `diagnostics`;
 * no-op when the property is absent or non-numeric.
 */
export function checkExtremeVolume(
  rawProps: Record<string, string>,
  nodeName: string,
  nodeType: string,
  rulePrefix: string,
  volumeDbMin: number,
  volumeDbMax: number,
  diagnostics: Diagnostic[]
): void {
  if (rawProps.volume_db === undefined) return;
  const volumeDb = parseFloat(rawProps.volume_db);
  if (Number.isNaN(volumeDb)) return;

  if (volumeDb < volumeDbMin) {
    diagnostics.push({
      severity: 'warning',
      message: `Volume is very low (${volumeDb} dB). Values below ${volumeDbMin} dB are rarely intentional.`,
      nodeName,
      nodeType,
      ruleName: `${rulePrefix}-extreme-volume`,
    });
  } else if (volumeDb > volumeDbMax) {
    diagnostics.push({
      severity: 'warning',
      message: `Volume is very high (${volumeDb} dB). Values above ${volumeDbMax} dB can cause distortion.`,
      nodeName,
      nodeType,
      ruleName: `${rulePrefix}-extreme-volume`,
    });
  }
}

/**
 * Warn when a positive `pitch_scale` falls outside the typical 0.5–2.0 range
 * (`<prefix>-unusual-pitch`). Non-positive values are the slice's own concern.
 */
export function checkUnusualPitch(
  rawProps: Record<string, string>,
  nodeName: string,
  nodeType: string,
  rulePrefix: string,
  diagnostics: Diagnostic[]
): void {
  if (rawProps.pitch_scale === undefined) return;
  const pitchScale = parseFloat(rawProps.pitch_scale);
  if (Number.isNaN(pitchScale) || pitchScale <= 0) return;

  if (pitchScale < TYPICAL_PITCH_SCALE_MIN) {
    diagnostics.push({
      severity: 'warning',
      message: `Pitch scale is very low (${pitchScale}). Values below ${TYPICAL_PITCH_SCALE_MIN} sound very slow/deep.`,
      nodeName,
      nodeType,
      ruleName: `${rulePrefix}-unusual-pitch`,
    });
  } else if (pitchScale > TYPICAL_PITCH_SCALE_MAX) {
    diagnostics.push({
      severity: 'warning',
      message: `Pitch scale is very high (${pitchScale}). Values above ${TYPICAL_PITCH_SCALE_MAX} sound very fast/high-pitched.`,
      nodeName,
      nodeType,
      ruleName: `${rulePrefix}-unusual-pitch`,
    });
  }
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
