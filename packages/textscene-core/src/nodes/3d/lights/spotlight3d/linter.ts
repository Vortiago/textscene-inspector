/**
 * Semantic linter rules for SpotLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { lightEnergyArms } from '../shared/linterChecks.js';

// Thresholds for warnings
const LARGE_SPOT_RANGE = 1000;
const SMALL_SPOT_RANGE = 0.1;
const EXTREME_SPOT_ATTENUATION_MIN = 0.1;
const EXTREME_SPOT_ATTENUATION_MAX = 5;
const EXTREME_SPOT_ANGLE_ATTENUATION_MIN = 0.1;
const EXTREME_SPOT_ANGLE_ATTENUATION_MAX = 5;
const SMALL_SPOT_ANGLE = 1;

/**
 * Validate SpotLight3D semantic rules
 */
function checkSpotLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  // Only run for SpotLight3D nodes
  if (node.type !== 'SpotLight3D') {
    return [];
  }

  return rangeAdvisories(node, {
    light_energy: lightEnergyArms('spotlight3d'),
    spot_range: [
      {
        over: LARGE_SPOT_RANGE,
        ruleName: 'spotlight3d-large-range',
        message: (range) =>
          `Light range is very large (${range}). Values above ${LARGE_SPOT_RANGE} can impact performance significantly.`,
      },
      {
        under: SMALL_SPOT_RANGE,
        ruleName: 'spotlight3d-small-range',
        message: (range) =>
          `Light range is very small (${range}). Values below ${SMALL_SPOT_RANGE} might not be visible.`,
      },
    ],
    spot_attenuation: [
      {
        under: EXTREME_SPOT_ATTENUATION_MIN,
        ruleName: 'spotlight3d-extreme-attenuation',
        message: (attenuation) =>
          `Light attenuation is very low (${attenuation}). Values below ${EXTREME_SPOT_ATTENUATION_MIN} result in very slow falloff.`,
      },
      {
        over: EXTREME_SPOT_ATTENUATION_MAX,
        ruleName: 'spotlight3d-extreme-attenuation',
        message: (attenuation) =>
          `Light attenuation is very high (${attenuation}). Values above ${EXTREME_SPOT_ATTENUATION_MAX} result in very fast falloff.`,
      },
    ],
    spot_angle_attenuation: [
      {
        under: EXTREME_SPOT_ANGLE_ATTENUATION_MIN,
        ruleName: 'spotlight3d-extreme-angle-attenuation',
        message: (angleAttenuation) =>
          `Angular attenuation is very low (${angleAttenuation}). Values below ${EXTREME_SPOT_ANGLE_ATTENUATION_MIN} result in very soft edges.`,
      },
      {
        over: EXTREME_SPOT_ANGLE_ATTENUATION_MAX,
        ruleName: 'spotlight3d-extreme-angle-attenuation',
        message: (angleAttenuation) =>
          `Angular attenuation is very high (${angleAttenuation}). Values above ${EXTREME_SPOT_ANGLE_ATTENUATION_MAX} result in very sharp edges.`,
      },
    ],
    spot_angle: [
      {
        under: SMALL_SPOT_ANGLE,
        floor: 0,
        ruleName: 'spotlight3d-small-angle',
        message: (angle) =>
          `Spot angle is very small (${angle} degrees). Values below ${SMALL_SPOT_ANGLE} degree might not be visible.`,
      },
    ],
  });
}

/**
 * SpotLight3D semantic validation rule
 */
const spotLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-spotlight3d-properties',
    description: 'Validates SpotLight3D property values, required properties, and performance considerations',
    category: 'validation',
    applicableNodeTypes: ['SpotLight3D'],
  },
  check: checkSpotLight3D,
};

// Self-register the rule
ruleRegistry.register(spotLight3DValidationRule);

// Export for testing
export { spotLight3DValidationRule };
