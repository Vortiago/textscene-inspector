/**
 * Semantic linter rules for NavigationRegion2D.
 *
 * If a navigation_polygon reference is provided, it must resolve to a
 * declared resource. The reference is optional — an absent reference must
 * not be flagged (Godot bakes one at runtime).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

function checkNavigationRegion2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  if (node.type !== 'NavigationRegion2D') {
    return diagnostics;
  }

  const rawProps = node.properties as unknown as Record<string, string>;

  const ref = rawProps.navigation_polygon;
  if (!ref) {
    return diagnostics;
  }

  if (!checkResourceExists(scene, ref)) {
    diagnostics.push({
      severity: 'error',
      message: `Navigation polygon resource not found: ${ref} (navigation_polygon)`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-navigationregion2d-resources',
    });
  }

  return diagnostics;
}

const navigationRegion2DValidationRule: LintRule = {
  meta: {
    name: 'valid-navigationregion2d-resources',
    description: 'Validates NavigationRegion2D navigation_polygon reference resolves',
    category: 'validation',
    applicableNodeTypes: ['NavigationRegion2D'],
  },
  check: checkNavigationRegion2D,
};

ruleRegistry.register(navigationRegion2DValidationRule);

export { navigationRegion2DValidationRule };
