/**
 * Semantic linter rules for SpotLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { projectorWithoutShadowDiagnostic } from '../shared/linterChecks.js';
import { parseGodotFloat } from '../../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../../godot/index.js';

/** `Light3D::set_param` default for `PARAM_SPOT_ANGLE` (light_3d.cpp:480). */
const DEFAULT_SPOT_ANGLE = 45;

/**
 * Validate SpotLight3D semantic rules
 *
 * No range advisory here: `spot_range`, `spot_angle` and `light_energy` carry
 * their hint bounds in the validators (light_3d.cpp:672, :674, :389), while
 * `spot_attenuation` hints "-10,10,0.01,or_greater,or_less" (light_3d.cpp:673)
 * so both ends are open, and `spot_angle_attenuation` is
 * PROPERTY_HINT_EXP_EASING (:675), which states no range at all.
 *
 * light_3d.cpp:655: `shadow_enabled` true and `spot_angle >= 90` — the guard is
 * `>=` even though the message says "wider than". light_3d.cpp:659-661:
 * `light_projector` set while `shadow_enabled` is not true, same shape as
 * OmniLight3D's.
 */
function checkSpotLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics: Diagnostic[] = [];

  if (isValidProperties(node.properties)) {
    const properties = node.properties as Record<string, string>;
    const spotAngle =
      properties.spot_angle !== undefined
        ? parseGodotFloat(properties.spot_angle)
        : DEFAULT_SPOT_ANGLE;

    // No finiteness guard: `spot_angle = inf` is a shadowless cone wider than
    // 90 degrees (light_3d.cpp:655), and `nan >= 90` is false either way.
    if (boolSlotValue(properties.shadow_enabled) === true && spotAngle !== null && spotAngle >= 90) {
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
