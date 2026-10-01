/**
 * SpotLight3D semantic rules. linterParser.ts validates the format.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';
import { projectorArm, projectorWithoutShadowDiagnostic } from '../shared/linterChecks.js';
import { parseGodotFloat } from '../../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../../godot/index.js';

/** `Light3D::set_param` default for `PARAM_SPOT_ANGLE` (light_3d.cpp:480). */
const DEFAULT_SPOT_ANGLE = 45;

const arms = {
  shadowAngleTooWide: groundedArm('spotlight3d-shadow-angle-too-wide', { kind: 'configuration-warning' }),
  projectorWithoutShadow: projectorArm('spotlight3d'),
} as const satisfies RuleArms<string>;

/**
 * No range advisory: the validators hold the `spot_range`, `spot_angle` and
 * `light_energy` bounds (light_3d.cpp:672, :674, :389), `spot_attenuation`
 * (light_3d.cpp:673) is open at both ends, and `spot_angle_attenuation` is
 * PROPERTY_HINT_EXP_EASING (:675).
 */
function checkSpotLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics: Diagnostic[] = [];

  if (isValidProperties(node.properties)) {
    const properties = node.properties as Record<string, string>;
    const spotAngle =
      properties.spot_angle !== undefined ? parseGodotFloat(properties.spot_angle) : DEFAULT_SPOT_ANGLE;

    // light_3d.cpp:655 guards `>=` though the message says "wider than". No
    // finiteness guard: `spot_angle = inf` is a shadowless cone wider than 90
    // degrees, and `nan >= 90` is false either way.
    if (boolSlotValue(properties.shadow_enabled) === true && spotAngle !== null && spotAngle >= 90) {
      reportArm(
        diagnostics,
        arms.shadowAngleTooWide,
        node,
        `SpotLight3D '${node.name}' has shadow_enabled with a spot_angle of ${spotAngle} degrees. An angle wider than 90 degrees cannot cast shadows.`
      );
    }
  }

  // light_3d.cpp:659-661, the same shape as OmniLight3D's.
  const projectorDiagnostic = projectorWithoutShadowDiagnostic(node, arms.projectorWithoutShadow);
  if (projectorDiagnostic) diagnostics.push(projectorDiagnostic);

  return diagnostics;
}

const spotLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-spotlight3d-properties',
    description: 'Validates SpotLight3D property values against the ranges the editor accepts',
    category: 'validation',
    applicableNodeTypes: ['SpotLight3D'],
    emits: armEmits(arms),
  },
  check: checkSpotLight3D,
};

ruleRegistry.register(spotLight3DValidationRule);

export { spotLight3DValidationRule };
