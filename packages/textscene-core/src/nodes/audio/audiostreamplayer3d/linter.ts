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
  player3DVolumeArms,
  player3DPitchArms,
  checkInvalidMaxPolyphony,
} from '../sharedLinterChecks.js';

// audio_stream_player_3d.cpp:885, unit_size PROPERTY_HINT_RANGE
// "0.1,100,0.01,or_greater": top end open, and set_unit_size (:569) is a bare
// assignment, so the bottom is a warning rather than an error.
const UNIT_SIZE_HINT_MIN = 0.1;

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

  // ERROR: max_distance must be >= 0 (audio_stream_player_3d.cpp:660,
  // ERR_FAIL_COND(p_metres < 0.0))
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

  // ERROR: pitch_scale must be > 0 (audio_stream_player_internal.cpp:314,
  // ERR_FAIL_COND(p_pitch_scale <= 0.0); all three players route through it)
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

  // Range advisories: volume, unit size and pitch bands.
  diagnostics.push(
    ...rangeAdvisories(node, {
      volume_db: player3DVolumeArms('audiostreamplayer3d'),
      unit_size: [
        {
          under: UNIT_SIZE_HINT_MIN,
          ruleName: 'audiostreamplayer3d-small-unit-size',
          cite: 'audio_stream_player_3d.cpp:885',
          message: (unitSize) =>
            `Property 'unit_size' is ${unitSize}. The editor range starts at ${UNIT_SIZE_HINT_MIN}.`,
        },
      ],
      pitch_scale: player3DPitchArms('audiostreamplayer3d'),
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
      { ruleName: 'audiostreamplayer3d-small-unit-size', severity: 'warning' },
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
