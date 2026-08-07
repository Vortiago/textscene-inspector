/**
 * Semantic linter rules for OmniLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { lightEnergyArms, omniRangeArms, projectorWithoutShadowDiagnostic } from '../shared/linterChecks.js';

/**
 * Validate OmniLight3D semantic rules
 *
 * `omni_attenuation` carries no advisory: light_3d.cpp:640 hints
 * "-10,10,0.001,or_greater,or_less", so BOTH ends are open and no value is out
 * of band.
 *
 * light_3d.cpp:623-625: `light_projector` set while `shadow_enabled` is not true.
 */
function checkOmniLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics = rangeAdvisories(node, {
    light_energy: lightEnergyArms('omnilight3d'),
    omni_range: omniRangeArms('omnilight3d'),
  });

  const projectorDiagnostic = projectorWithoutShadowDiagnostic(node, 'omnilight3d');
  if (projectorDiagnostic) diagnostics.push(projectorDiagnostic);

  return diagnostics;
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
      { ruleName: 'omnilight3d-projector-without-shadow', severity: 'warning' },
    ],
  },
  check: checkOmniLight3D,
};

// Self-register the rule
ruleRegistry.register(omniLight3DValidationRule);

// Export for testing
export { omniLight3DValidationRule };
