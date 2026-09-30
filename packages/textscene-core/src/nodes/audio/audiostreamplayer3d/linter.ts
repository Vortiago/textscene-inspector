/**
 * Semantic linter rules for AudioStreamPlayer3D. linterParser.ts validates the format during strict
 * parsing. These rules need the full scene.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { boolSlotValue } from '../../../godot/index.js';
import { armEmits, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  emissionAngleNotEnabled: {
    severity: 'info',
    ruleName: 'audiostreamplayer3d-emission-angle-not-enabled',
    grounding: {
      kind: 'engine-inert',
      at: 'audio_stream_player_3d.cpp:898',
      unused: 'the group-enable toggle gates the whole emission_angle group',
    },
  },
  emissionFilterNotEnabled: {
    severity: 'info',
    ruleName: 'audiostreamplayer3d-emission-filter-not-enabled',
    grounding: {
      kind: 'engine-inert',
      at: 'audio_stream_player_3d.cpp:898',
      unused: 'the group-enable toggle gates the whole emission_angle group',
    },
  },
} as const satisfies RuleArms<string>;

/**
 * Validate AudioStreamPlayer3D semantic rules
 */
function checkAudioStreamPlayer3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // A player with no `stream` at all gets no diagnostic: that is the serialised
  // default, audio_stream_player_3d.cpp defines no configuration warning, and a
  // script or an AnimationPlayer audio track may supply the stream instead.

  // emission_angle_degrees without emission_angle_enabled.
  if (rawProps.emission_angle_degrees !== undefined && boolSlotValue(rawProps.emission_angle_enabled) !== true) {
    reportArm(
      diagnostics,
      arms.emissionAngleNotEnabled,
      node,
      `Property 'emission_angle_degrees' is set but 'emission_angle_enabled' is not true. The emission angle will have no effect.`
    );
  }

  // emission_angle_filter_attenuation_db without emission_angle_enabled.
  if (rawProps.emission_angle_filter_attenuation_db !== undefined && boolSlotValue(rawProps.emission_angle_enabled) !== true) {
    reportArm(
      diagnostics,
      arms.emissionFilterNotEnabled,
      node,
      `Property 'emission_angle_filter_attenuation_db' is set but 'emission_angle_enabled' is not true. The filter will have no effect.`
    );
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
    emits: armEmits(arms),
  },
  check: checkAudioStreamPlayer3D,
};

ruleRegistry.register(audioStreamPlayer3DValidationRule);

// Export for testing
export { audioStreamPlayer3DValidationRule };
