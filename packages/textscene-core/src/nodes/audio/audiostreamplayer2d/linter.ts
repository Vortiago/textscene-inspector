/**
 * Semantic linter rules for AudioStreamPlayer2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import {
  extremeVolumeArms,
  unusualPitchArms,
  checkInvalidMaxPolyphony,
} from '../sharedLinterChecks.js';

// Thresholds for warnings
const EXTREME_VOLUME_DB_MIN = -60;
const EXTREME_VOLUME_DB_MAX = 20;
const MIN_MAX_DISTANCE_2D = 10;
const MAX_MAX_DISTANCE_2D = 10000;
const MIN_ATTENUATION = 0.1;
const MAX_ATTENUATION = 10;

/**
 * Validate AudioStreamPlayer2D semantic rules
 */
function checkAudioStreamPlayer2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for AudioStreamPlayer2D nodes
  if (node.type !== 'AudioStreamPlayer2D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // ERROR: stream is missing (REQUIRED - no sound without this)
  if (rawProps.stream === undefined) {
    diagnostics.push({
      severity: 'error',
      message: `AudioStreamPlayer2D requires 'stream' property to function. This defines what audio to play.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer2d-missing-stream',
    });
  } else {
    // ERROR: stream resource doesn't exist
    if (!checkResourceExists(scene, rawProps.stream)) {
      diagnostics.push({
        severity: 'error',
        message: `Stream resource "${rawProps.stream}" does not exist in scene. AudioStreamPlayer2D will not play audio.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer2d-missing-stream-resource',
      });
    }
  }

  // WARNING: autoplay enabled but no stream set
  if (rawProps.autoplay === 'true' && rawProps.stream === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'autoplay' is enabled but no 'stream' is set. Audio will not play automatically.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer2d-autoplay-without-stream',
    });
  }

  // ERROR: pitch_scale = 0 (already caught by format validator, but add semantic context)
  if (rawProps.pitch_scale !== undefined) {
    const pitchScale = parseFloat(rawProps.pitch_scale);
    if (!isNaN(pitchScale) && pitchScale === 0) {
      diagnostics.push({
        severity: 'error',
        message: `Property 'pitch_scale' is 0. Audio will not play. Use values > 0.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer2d-zero-pitch-scale',
      });
    }
  }

  // Range advisories: distance / attenuation / volume / pitch bands.
  diagnostics.push(
    ...rangeAdvisories(node, {
      max_distance: [
        {
          under: MIN_MAX_DISTANCE_2D,
          ruleName: 'audiostreamplayer2d-small-max-distance',
          message: (maxDistance) =>
            `Property 'max_distance' is very small (${maxDistance}). Values below ${MIN_MAX_DISTANCE_2D} may cause audio to cut off too quickly in 2D games.`,
        },
        {
          over: MAX_MAX_DISTANCE_2D,
          ruleName: 'audiostreamplayer2d-large-max-distance',
          message: (maxDistance) =>
            `Property 'max_distance' is very large (${maxDistance}). Values above ${MAX_MAX_DISTANCE_2D} may cause audio to be heard from too far away in 2D games.`,
        },
      ],
      attenuation: [
        {
          under: MIN_ATTENUATION,
          ruleName: 'audiostreamplayer2d-flat-attenuation',
          message: (attenuation) =>
            `Property 'attenuation' is very flat (${attenuation}). Values below ${MIN_ATTENUATION} cause very slow distance falloff.`,
        },
        {
          over: MAX_ATTENUATION,
          ruleName: 'audiostreamplayer2d-steep-attenuation',
          message: (attenuation) =>
            `Property 'attenuation' is very steep (${attenuation}). Values above ${MAX_ATTENUATION} cause very rapid distance falloff.`,
        },
      ],
      volume_db: extremeVolumeArms('audiostreamplayer2d', EXTREME_VOLUME_DB_MIN, EXTREME_VOLUME_DB_MAX),
      pitch_scale: unusualPitchArms('audiostreamplayer2d'),
    })
  );

  checkInvalidMaxPolyphony(rawProps, node.name, node.type, 'audiostreamplayer2d', diagnostics);

  return diagnostics;
}

/**
 * AudioStreamPlayer2D semantic validation rule
 */
const audioStreamPlayer2DValidationRule: LintRule = {
  meta: {
    name: 'valid-audiostreamplayer2d-properties',
    description: 'Validates AudioStreamPlayer2D property values, required properties, and logical consistency',
    category: 'validation',
    applicableNodeTypes: ['AudioStreamPlayer2D'],
    emits: [
      { ruleName: 'audiostreamplayer2d-missing-stream', severity: 'error' },
      { ruleName: 'audiostreamplayer2d-missing-stream-resource', severity: 'error' },
      { ruleName: 'audiostreamplayer2d-autoplay-without-stream', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-zero-pitch-scale', severity: 'error' },
      { ruleName: 'audiostreamplayer2d-small-max-distance', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-large-max-distance', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-flat-attenuation', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-steep-attenuation', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-extreme-volume', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-unusual-pitch', severity: 'warning' },
      { ruleName: 'audiostreamplayer2d-invalid-max-polyphony', severity: 'error' },
    ],
  },
  check: checkAudioStreamPlayer2D,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayer2DValidationRule);

// Export for testing
export { audioStreamPlayer2DValidationRule };
