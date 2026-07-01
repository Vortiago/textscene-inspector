/**
 * Semantic linter rules for AreaLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkLightEnergy } from '../shared/linterChecks.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

/**
 * Validate AreaLight3D semantic rules
 */
function checkAreaLight3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  if (node.type !== 'AreaLight3D') {
    return diagnostics;
  }

  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;
  checkLightEnergy(rawProps, node.name, node.type, 'arealight3d', diagnostics);

  return diagnostics;
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
  },
  check: checkAreaLight3D,
};

ruleRegistry.register(areaLight3DValidationRule);

export { areaLight3DValidationRule };
