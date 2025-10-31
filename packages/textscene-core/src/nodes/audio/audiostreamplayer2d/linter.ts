/**
 * Semantic linter rules for AudioStreamPlayer2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

// Thresholds for warnings
const EXTREME_VOLUME_DB_MIN = -60;
const EXTREME_VOLUME_DB_MAX = 20;
const TYPICAL_PITCH_SCALE_MIN = 0.5;
const TYPICAL_PITCH_SCALE_MAX = 2.0;
const MIN_MAX_DISTANCE_2D = 10;
const MAX_MAX_DISTANCE_2D = 10000;
const MIN_ATTENUATION = 0.1;
const MAX_ATTENUATION = 10;

/**
 * Check if properties object exists and is valid
 */
function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

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

  // WARNING: max_distance too small or too large for typical 2D games
  if (rawProps.max_distance !== undefined) {
    const maxDistance = parseFloat(rawProps.max_distance);
    if (!isNaN(maxDistance)) {
      if (maxDistance < MIN_MAX_DISTANCE_2D) {
        diagnostics.push({
          severity: 'warning',
          message: `Property 'max_distance' is very small (${maxDistance}). Values below ${MIN_MAX_DISTANCE_2D} may cause audio to cut off too quickly in 2D games.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-small-max-distance',
        });
      } else if (maxDistance > MAX_MAX_DISTANCE_2D) {
        diagnostics.push({
          severity: 'warning',
          message: `Property 'max_distance' is very large (${maxDistance}). Values above ${MAX_MAX_DISTANCE_2D} may cause audio to be heard from too far away in 2D games.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-large-max-distance',
        });
      }
    }
  }

  // WARNING: attenuation too steep or too flat
  if (rawProps.attenuation !== undefined) {
    const attenuation = parseFloat(rawProps.attenuation);
    if (!isNaN(attenuation)) {
      if (attenuation < MIN_ATTENUATION) {
        diagnostics.push({
          severity: 'warning',
          message: `Property 'attenuation' is very flat (${attenuation}). Values below ${MIN_ATTENUATION} cause very slow distance falloff.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-flat-attenuation',
        });
      } else if (attenuation > MAX_ATTENUATION) {
        diagnostics.push({
          severity: 'warning',
          message: `Property 'attenuation' is very steep (${attenuation}). Values above ${MAX_ATTENUATION} cause very rapid distance falloff.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-steep-attenuation',
        });
      }
    }
  }

  // WARNING: Extreme volume_db values
  if (rawProps.volume_db !== undefined) {
    const volumeDb = parseFloat(rawProps.volume_db);
    if (!isNaN(volumeDb)) {
      if (volumeDb < EXTREME_VOLUME_DB_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Volume is very low (${volumeDb} dB). Values below ${EXTREME_VOLUME_DB_MIN} dB are rarely intentional.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-extreme-volume',
        });
      } else if (volumeDb > EXTREME_VOLUME_DB_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Volume is very high (${volumeDb} dB). Values above ${EXTREME_VOLUME_DB_MAX} dB can cause distortion.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-extreme-volume',
        });
      }
    }
  }

  // WARNING: Unusual pitch_scale values
  if (rawProps.pitch_scale !== undefined) {
    const pitchScale = parseFloat(rawProps.pitch_scale);
    if (!isNaN(pitchScale) && pitchScale > 0) {
      if (pitchScale < TYPICAL_PITCH_SCALE_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Pitch scale is very low (${pitchScale}). Values below ${TYPICAL_PITCH_SCALE_MIN} sound very slow/deep.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-unusual-pitch',
        });
      } else if (pitchScale > TYPICAL_PITCH_SCALE_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Pitch scale is very high (${pitchScale}). Values above ${TYPICAL_PITCH_SCALE_MAX} sound very fast/high-pitched.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer2d-unusual-pitch',
        });
      }
    }
  }

  // ERROR: max_polyphony < 1
  if (rawProps.max_polyphony !== undefined) {
    const maxPolyphony = parseInt(rawProps.max_polyphony, 10);
    if (!isNaN(maxPolyphony) && maxPolyphony < 1) {
      diagnostics.push({
        severity: 'error',
        message: `Property 'max_polyphony' must be at least 1 (got ${maxPolyphony}). Values below 1 cause runtime errors.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer2d-invalid-max-polyphony',
      });
    }
  }

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
  },
  check: checkAudioStreamPlayer2D,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayer2DValidationRule);

// Export for testing
export { audioStreamPlayer2DValidationRule };
