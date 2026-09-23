/**
 * Semantic linter rule for LightOccluder2D, ported from the first arm of
 * `LightOccluder2D::get_configuration_warnings()` (light_occluder_2d.cpp:265-278):
 * a null `occluder` (light_occluder_2d.cpp:298), which an absent key is. The empty
 * polygon arm needs the resource's `polygon` value, which this linter does not resolve.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';

const RULE_NAME = 'lightoccluder2d-requires-occluder';

function checkLightOccluder2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  if (!resourceSlotIsEmpty(node.properties.occluder)) return [];

  return [
    {
      severity: 'warning',
      message: `LightOccluder2D '${node.name}' has no occluder polygon set. An occluder polygon must be set (or drawn) for this occluder to take effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const lightOccluder2DRequiresOccluderRule: LintRule = {
  meta: {
    name: 'valid-lightoccluder2d-occluder',
    description: 'Warns when a LightOccluder2D has no occluder polygon resource set',
    category: 'validation',
    applicableNodeTypes: ['LightOccluder2D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkLightOccluder2D,
};

ruleRegistry.register(lightOccluder2DRequiresOccluderRule);

export { lightOccluder2DRequiresOccluderRule };
