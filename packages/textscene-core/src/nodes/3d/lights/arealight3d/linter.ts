/**
 * Semantic linter rules for AreaLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { lightEnergyArms } from '../shared/linterChecks.js';

/**
 * Validate AreaLight3D semantic rules
 */
function checkAreaLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;


  return rangeAdvisories(node, {
    light_energy: lightEnergyArms('arealight3d'),
  });
}

/**
 * AreaLight3D semantic validation rule
 */
const areaLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-arealight3d-properties',
    description: 'Validates AreaLight3D property values and required properties',
    category: 'validation',
    applicableNodeTypes: ['AreaLight3D'],
    emits: [
      {
        ruleName: 'arealight3d-negative-energy',
        severity: 'warning',
        // The weakest citation in the sweep, and deliberately not an exemption.
        // AreaLight3D appears NOWHERE in 4.6.3, so it has no base chain here
        // (`nodeBaseTypes.generated.ts` derives one from that ClassDB) and this
        // line is Light3D's `light_energy` hint, not the node's own. What makes
        // it the honest choice is that `lightEnergyArms('arealight3d')` already
        // stamps the same cite on the RangeArm that produces this diagnostic,
        // and `rangeAdvisoryGrounding` accepts it: naming an exemption here
        // would leave two guards disagreeing about one fact.
        grounding: { kind: 'engine', at: 'light_3d.cpp:389' },
      },
    ],
  },
  check: checkAreaLight3D,
};

ruleRegistry.register(areaLight3DValidationRule);

export { areaLight3DValidationRule };
