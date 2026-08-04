/**
 * Semantic linter rules for SpotLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { lightEnergyArms, spotRangeArms } from '../shared/linterChecks.js';

/**
 * Validate SpotLight3D semantic rules
 *
 * Two SpotLight3D properties deliberately carry no advisory: `spot_attenuation`
 * hints "-10,10,0.01,or_greater,or_less" (light_3d.cpp:673) so both ends are
 * open, and `spot_angle_attenuation` is PROPERTY_HINT_EXP_EASING (:675), which
 * states no range at all.
 */
function checkSpotLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  return rangeAdvisories(node, {
    light_energy: lightEnergyArms('spotlight3d'),
    spot_range: spotRangeArms('spotlight3d'),
    spot_angle: [
      {
        // light_3d.cpp:674 — spot_angle PROPERTY_HINT_RANGE "0,180,0.01,degrees", both ends closed
        under: 0,
        ruleName: 'spotlight3d-spot-angle-out-of-range',
        cite: 'light_3d.cpp:674',
        message: (angle) =>
          `Spot angle is negative (${angle} degrees). The editor range for spot_angle is 0 to 180 degrees.`,
      },
      {
        over: 180,
        ruleName: 'spotlight3d-spot-angle-out-of-range',
        cite: 'light_3d.cpp:674',
        message: (angle) =>
          `Spot angle is ${angle} degrees. The editor range for spot_angle stops at 180 degrees.`,
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
    description: 'Validates SpotLight3D property values against the ranges the editor accepts',
    category: 'validation',
    applicableNodeTypes: ['SpotLight3D'],
    emits: [
      { ruleName: 'spotlight3d-negative-energy', severity: 'warning' },
      { ruleName: 'spotlight3d-negative-range', severity: 'warning' },
      { ruleName: 'spotlight3d-spot-angle-out-of-range', severity: 'warning' },
    ],
  },
  check: checkSpotLight3D,
};

// Self-register the rule
ruleRegistry.register(spotLight3DValidationRule);

// Export for testing
export { spotLight3DValidationRule };
