/**
 * Semantic linter rules for AudioStreamPlayer3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

// Thresholds for warnings
const EXTREME_VOLUME_DB_MIN = -40;
const EXTREME_VOLUME_DB_MAX = 6;
const TYPICAL_PITCH_SCALE_MIN = 0.5;
const TYPICAL_PITCH_SCALE_MAX = 2.0;

/**
 * Validate AudioStreamPlayer3D semantic rules
 */
function checkAudioStreamPlayer3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for AudioStreamPlayer3D nodes
  if (node.type !== 'AudioStreamPlayer3D') {
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
      message: `AudioStreamPlayer3D requires 'stream' property to function. This defines what audio to play.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer3d-missing-stream',
    });
  } else {
    // ERROR: stream resource doesn't exist
    if (!checkResourceExists(scene, rawProps.stream)) {
      diagnostics.push({
        severity: 'error',
        message: `Stream resource "${rawProps.stream}" does not exist in scene. AudioStreamPlayer3D will not play audio.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer3d-missing-stream-resource',
      });
    }
  }

  // ERROR: unit_size must be > 0
  if (rawProps.unit_size !== undefined) {
    const unitSize = parseFloat(rawProps.unit_size);
    if (!isNaN(unitSize) && unitSize <= 0) {
      diagnostics.push({
        severity: 'error',
        message: `Property 'unit_size' must be greater than 0 (got ${unitSize}). This property controls attenuation range.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer3d-invalid-unit-size',
      });
    }
  }

  // ERROR: max_distance must be >= 0
  if (rawProps.max_distance !== undefined) {
    const maxDistance = parseFloat(rawProps.max_distance);
    if (!isNaN(maxDistance) && maxDistance < 0) {
      diagnostics.push({
        severity: 'error',
        message: `Property 'max_distance' must be non-negative (got ${maxDistance}). Use 0 for unlimited distance.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer3d-invalid-max-distance',
      });
    }
  }

  // ERROR: pitch_scale must be > 0
  if (rawProps.pitch_scale !== undefined) {
    const pitchScale = parseFloat(rawProps.pitch_scale);
    if (!isNaN(pitchScale) && pitchScale <= 0) {
      diagnostics.push({
        severity: 'error',
        message: `Property 'pitch_scale' must be greater than 0 (got ${pitchScale}). Zero or negative pitch breaks audio.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'audiostreamplayer3d-invalid-pitch-scale',
      });
    }
  }

  // WARNING: emission_angle_degrees without emission_angle_enabled
  if (rawProps.emission_angle_degrees !== undefined && rawProps.emission_angle_enabled !== 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'emission_angle_degrees' is set but 'emission_angle_enabled' is not true. The emission angle will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer3d-emission-angle-not-enabled',
    });
  }

  // WARNING: emission_angle_filter_attenuation_db without emission_angle_enabled
  if (rawProps.emission_angle_filter_attenuation_db !== undefined && rawProps.emission_angle_enabled !== 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'emission_angle_filter_attenuation_db' is set but 'emission_angle_enabled' is not true. The filter will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer3d-emission-filter-not-enabled',
    });
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
          ruleName: 'audiostreamplayer3d-extreme-volume',
        });
      } else if (volumeDb > EXTREME_VOLUME_DB_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Volume is very high (${volumeDb} dB). Values above ${EXTREME_VOLUME_DB_MAX} dB can cause distortion.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer3d-extreme-volume',
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
          ruleName: 'audiostreamplayer3d-unusual-pitch',
        });
      } else if (pitchScale > TYPICAL_PITCH_SCALE_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Pitch scale is very high (${pitchScale}). Values above ${TYPICAL_PITCH_SCALE_MAX} sound very fast/high-pitched.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer3d-unusual-pitch',
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
        ruleName: 'audiostreamplayer3d-invalid-max-polyphony',
      });
    }
  }

  return diagnostics;
}

/**
 * AudioStreamPlayer3D semantic validation rule
 */
const audioStreamPlayer3DValidationRule: LintRule = {
  meta: {
    name: 'valid-audiostreamplayer3d-properties',
    description: 'Validates AudioStreamPlayer3D property values, required properties, and logical consistency',
    category: 'validation',
    applicableNodeTypes: ['AudioStreamPlayer3D'],
  },
  check: checkAudioStreamPlayer3D,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayer3DValidationRule);

// Export for testing
export { audioStreamPlayer3DValidationRule };
