/**
 * OmniLight3D semantic rules. linterParser.ts validates the format.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armEmits } from '../../../../linter/ruleArms.js';
import { projectorArms, projectorWithoutShadowDiagnostic } from '../shared/linterChecks.js';

const arms = projectorArms('omnilight3d');

/**
 * light_3d.cpp:623-625: `light_projector` set while `shadow_enabled` is not true.
 * No range advisory: `omni_range` and `light_energy` floors are validator bounds
 * (light_3d.cpp:639, :389), and `omni_attenuation` (light_3d.cpp:640) is open at both ends.
 */
function checkOmniLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const projectorDiagnostic = projectorWithoutShadowDiagnostic(node, arms);
  return projectorDiagnostic ? [projectorDiagnostic] : [];
}

const omniLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-omnilight3d-properties',
    description: 'Validates OmniLight3D property values against the ranges the editor accepts',
    category: 'validation',
    applicableNodeTypes: ['OmniLight3D'],
    emits: armEmits(arms),
  },
  check: checkOmniLight3D,
};

ruleRegistry.register(omniLight3DValidationRule);

export { omniLight3DValidationRule };
