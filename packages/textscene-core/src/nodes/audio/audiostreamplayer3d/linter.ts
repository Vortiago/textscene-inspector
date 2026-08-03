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
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import {
  extremeVolumeArms,
  unusualPitchArms,
  checkInvalidMaxPolyphony,
} from '../sharedLinterChecks.js';

// 3D tolerates a narrower volume range than the 2D/base players
const EXTREME_VOLUME_DB_MIN = -40;
const EXTREME_VOLUME_DB_MAX = 6;

/**
 * Validate AudioStreamPlayer3D semantic rules
 */
function checkAudioStreamPlayer3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // Advisory, not an error: audio_stream_player_3d.cpp defines no
  // configuration warning, and a player with no stream is valid Godot; a script
  // may assign one at runtime.
  if (rawProps.stream === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `AudioStreamPlayer3D '${node.name}' has no 'stream', so it will not play anything until one is assigned.`,
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

  // Range advisories: volume + pitch bands.
  diagnostics.push(
    ...rangeAdvisories(node, {
      volume_db: extremeVolumeArms('audiostreamplayer3d', EXTREME_VOLUME_DB_MIN, EXTREME_VOLUME_DB_MAX),
      pitch_scale: unusualPitchArms('audiostreamplayer3d'),
    })
  );

  checkInvalidMaxPolyphony(rawProps, node.name, node.type, 'audiostreamplayer3d', diagnostics);

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
    emits: [
      { ruleName: 'audiostreamplayer3d-missing-stream', severity: 'warning' },
      { ruleName: 'audiostreamplayer3d-missing-stream-resource', severity: 'error' },
      { ruleName: 'audiostreamplayer3d-invalid-unit-size', severity: 'error' },
      { ruleName: 'audiostreamplayer3d-invalid-max-distance', severity: 'error' },
      { ruleName: 'audiostreamplayer3d-invalid-pitch-scale', severity: 'error' },
      { ruleName: 'audiostreamplayer3d-emission-angle-not-enabled', severity: 'warning' },
      { ruleName: 'audiostreamplayer3d-emission-filter-not-enabled', severity: 'warning' },
      { ruleName: 'audiostreamplayer3d-extreme-volume', severity: 'warning' },
      { ruleName: 'audiostreamplayer3d-unusual-pitch', severity: 'warning' },
      { ruleName: 'audiostreamplayer3d-invalid-max-polyphony', severity: 'error' },
    ],
  },
  check: checkAudioStreamPlayer3D,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayer3DValidationRule);

// Export for testing
export { audioStreamPlayer3DValidationRule };
