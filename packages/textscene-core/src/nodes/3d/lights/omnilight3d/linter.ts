/**
 * Semantic linter rules for OmniLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { projectorWithoutShadowDiagnostic } from '../shared/linterChecks.js';

/**
 * Validate OmniLight3D semantic rules
 *
 * No range advisory here: `omni_range`'s and `light_energy`'s hint floors are
 * validator bounds (light_3d.cpp:639, :389), and `omni_attenuation` hints
 * "-10,10,0.001,or_greater,or_less" (light_3d.cpp:640) so BOTH ends are open.
 *
 * light_3d.cpp:623-625: `light_projector` set while `shadow_enabled` is not true.
 */
function checkOmniLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const projectorDiagnostic = projectorWithoutShadowDiagnostic(node, 'omnilight3d');
  return projectorDiagnostic ? [projectorDiagnostic] : [];
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
      { ruleName: 'omnilight3d-projector-without-shadow', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkOmniLight3D,
};

// Self-register the rule
ruleRegistry.register(omniLight3DValidationRule);

// Export for testing
export { omniLight3DValidationRule };
