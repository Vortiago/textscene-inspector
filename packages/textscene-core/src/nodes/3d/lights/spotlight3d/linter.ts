/**
 * Semantic linter rules for SpotLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { lightEnergyArms, spotRangeArms, projectorWithoutShadowDiagnostic } from '../shared/linterChecks.js';

/** `Light3D::set_param` default for `PARAM_SPOT_ANGLE` (light_3d.cpp:480). */
const DEFAULT_SPOT_ANGLE = 45;

/**
 * Validate SpotLight3D semantic rules
 *
 * Two SpotLight3D properties deliberately carry no advisory: `spot_attenuation`
 * hints "-10,10,0.01,or_greater,or_less" (light_3d.cpp:673) so both ends are
 * open, and `spot_angle_attenuation` is PROPERTY_HINT_EXP_EASING (:675), which
 * states no range at all.
 *
 * light_3d.cpp:655: `shadow_enabled` true and `spot_angle >= 90` — the guard is
 * `>=` even though the message says "wider than". light_3d.cpp:659-661:
 * `light_projector` set while `shadow_enabled` is not true, same shape as
 * OmniLight3D's.
 */
function checkSpotLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics = rangeAdvisories(node, {
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

  if (isValidProperties(node.properties)) {
    const properties = node.properties as Record<string, string>;
    const spotAngle =
      properties.spot_angle !== undefined ? parseFloat(properties.spot_angle) : DEFAULT_SPOT_ANGLE;

    if (properties.shadow_enabled === 'true' && !isNaN(spotAngle) && spotAngle >= 90) {
      diagnostics.push({
        severity: 'warning',
        message: `SpotLight3D '${node.name}' has shadow_enabled with a spot_angle of ${spotAngle} degrees. An angle wider than 90 degrees cannot cast shadows.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'spotlight3d-shadow-angle-too-wide',
      });
    }
  }

  const projectorDiagnostic = projectorWithoutShadowDiagnostic(node, 'spotlight3d');
  if (projectorDiagnostic) diagnostics.push(projectorDiagnostic);

  return diagnostics;
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
      {
        ruleName: 'spotlight3d-negative-energy',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'light_3d.cpp:389' },
      },
      {
        ruleName: 'spotlight3d-negative-range',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'light_3d.cpp:672' },
      },
      {
        ruleName: 'spotlight3d-spot-angle-out-of-range',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'light_3d.cpp:674' },
      },
      { ruleName: 'spotlight3d-shadow-angle-too-wide', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'spotlight3d-projector-without-shadow', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkSpotLight3D,
};

// Self-register the rule
ruleRegistry.register(spotLight3DValidationRule);

// Export for testing
export { spotLight3DValidationRule };
