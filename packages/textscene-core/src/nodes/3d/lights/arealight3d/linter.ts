/**
 * AreaLight3D semantic rules. linterParser.ts validates the format.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../../linter/ruleArms.js';
import { hasProjector } from '../shared/linterChecks.js';

const arms = {
  projectorUnsupported: groundedArm('arealight3d-projector-unsupported', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

/**
 * "Projector texture is not supported for area lights." (4.7.2 light_3d.cpp:774-776). The
 * Compatibility warnings read the rendering method, which no scene holds (:777-783).
 */
function checkAreaLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!hasProjector(node)) return [];
  return [
    armDiagnostic(
      arms.projectorUnsupported,
      node,
      `AreaLight3D '${node.name}' has a light_projector texture set. Projector texture is not supported for area lights. Use the area_texture field instead.`
    ),
  ];
}

const areaLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-arealight3d-properties',
    description: 'Reports an AreaLight3D projector, which Godot does not draw',
    category: 'validation',
    applicableNodeTypes: ['AreaLight3D'],
    emits: armEmits(arms),
  },
  check: checkAreaLight3D,
};

ruleRegistry.register(areaLight3DValidationRule);

export { areaLight3DValidationRule };
