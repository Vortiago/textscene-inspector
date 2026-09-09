/**
 * Semantic linter rules for AudioStreamPlayer3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { boolSlotValue } from '../../../godot/index.js';

/**
 * Validate AudioStreamPlayer3D semantic rules
 */
function checkAudioStreamPlayer3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // A player with no `stream` at all gets no diagnostic: that is the serialised
  // default, audio_stream_player_3d.cpp defines no configuration warning, and a
  // script or an AnimationPlayer audio track may supply the stream instead.

  // emission_angle_degrees without emission_angle_enabled.
  if (rawProps.emission_angle_degrees !== undefined && boolSlotValue(rawProps.emission_angle_enabled) !== true) {
    diagnostics.push({
      severity: 'info',
      message: `Property 'emission_angle_degrees' is set but 'emission_angle_enabled' is not true. The emission angle will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer3d-emission-angle-not-enabled',
    });
  }

  // emission_angle_filter_attenuation_db without emission_angle_enabled.
  if (rawProps.emission_angle_filter_attenuation_db !== undefined && boolSlotValue(rawProps.emission_angle_enabled) !== true) {
    diagnostics.push({
      severity: 'info',
      message: `Property 'emission_angle_filter_attenuation_db' is set but 'emission_angle_enabled' is not true. The filter will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer3d-emission-filter-not-enabled',
    });
  }

  return diagnostics;
}

/**
 * AudioStreamPlayer3D semantic validation rule
 */
const audioStreamPlayer3DValidationRule: LintRule = {
  meta: {
    name: 'valid-audiostreamplayer3d-properties',
    description: 'Validates AudioStreamPlayer3D property values and logical consistency',
    category: 'validation',
    applicableNodeTypes: ['AudioStreamPlayer3D'],
    emits: [
      {
        ruleName: 'audiostreamplayer3d-emission-angle-not-enabled',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'audio_stream_player_3d.cpp:898',
          unused: 'the group-enable toggle gates the whole emission_angle group',
        },
      },
      {
        ruleName: 'audiostreamplayer3d-emission-filter-not-enabled',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'audio_stream_player_3d.cpp:898',
          unused: 'the group-enable toggle gates the whole emission_angle group',
        },
      },
    ],
  },
  check: checkAudioStreamPlayer3D,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayer3DValidationRule);

// Export for testing
export { audioStreamPlayer3DValidationRule };
