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

/**
 * Validate OmniLight3D semantic rules
 *
 * `omni_attenuation` carries no advisory: light_3d.cpp:640 hints
 * "-10,10,0.001,or_greater,or_less", so BOTH ends are open and no value is out
 * of band.
 */
function checkOmniLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  return rangeAdvisories(node, {
    light_energy: lightEnergyArms('omnilight3d'),
    omni_range: lightRangeArms('omnilight3d'),
  });
}

/**
 * OmniLight3D semantic validation rule
 */
const omniLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-omnilight3d-properties',
    description: 'Validates OmniLight3D property values against the ranges the editor accepts',
    category: 'validation',
    applicableNodeTypes: ['OmniLight3D'],
    emits: [
      { ruleName: 'omnilight3d-negative-energy', severity: 'warning' },
      { ruleName: 'omnilight3d-negative-range', severity: 'warning' },
    ],
  },
  check: checkOmniLight3D,
};

// Self-register the rule
ruleRegistry.register(omniLight3DValidationRule);

// Export for testing
export { omniLight3DValidationRule };
