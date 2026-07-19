/**
 * Semantic linter rules for OmniLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { lightEnergyArms, lightRangeArms } from '../shared/linterChecks.js';

// Thresholds for warnings
const LARGE_OMNI_RANGE = 1000;
const SMALL_OMNI_RANGE = 0.1;
const EXTREME_OMNI_ATTENUATION_MIN = 0.1;
const EXTREME_OMNI_ATTENUATION_MAX = 5;

/**
 * Validate OmniLight3D semantic rules
 */
function checkOmniLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  // Only run for OmniLight3D nodes
  if (node.type !== 'OmniLight3D') {
    return [];
  }

  return rangeAdvisories(node, {
    light_energy: lightEnergyArms('omnilight3d'),
    omni_range: lightRangeArms('omnilight3d', LARGE_OMNI_RANGE, SMALL_OMNI_RANGE),
    omni_attenuation: [
      {
        under: EXTREME_OMNI_ATTENUATION_MIN,
        ruleName: 'omnilight3d-extreme-attenuation',
        message: (attenuation) =>
          `Light attenuation is very low (${attenuation}). Values below ${EXTREME_OMNI_ATTENUATION_MIN} result in very slow falloff.`,
      },
      {
        over: EXTREME_OMNI_ATTENUATION_MAX,
        ruleName: 'omnilight3d-extreme-attenuation',
        message: (attenuation) =>
          `Light attenuation is very high (${attenuation}). Values above ${EXTREME_OMNI_ATTENUATION_MAX} can impact performance if range is also large.`,
      },
    ],
  });
}

/**
 * OmniLight3D semantic validation rule
 */
const omniLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-omnilight3d-properties',
    description: 'Validates OmniLight3D property values, required properties, and performance considerations',
    category: 'validation',
    applicableNodeTypes: ['OmniLight3D'],
  },
  check: checkOmniLight3D,
};

// Self-register the rule
ruleRegistry.register(omniLight3DValidationRule);

// Export for testing
export { omniLight3DValidationRule };
