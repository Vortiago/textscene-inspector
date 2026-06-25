/**
 * Semantic linter rules for NavigationRegion3D.
 *
 * If a navigation_mesh reference is provided, it must resolve to a
 * declared resource. The reference is optional — an absent reference must
 * not be flagged (Godot bakes one at runtime).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

function checkNavigationRegion3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  if (node.type !== 'NavigationRegion3D') {
    return diagnostics;
  }

  const rawProps = node.properties as unknown as Record<string, string>;

  const ref = rawProps.navigation_mesh;
  if (!ref) {
    return diagnostics;
  }

  if (!checkResourceExists(scene, ref)) {
    diagnostics.push({
      severity: 'error',
      message: `Navigation mesh resource not found: ${ref} (navigation_mesh)`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-navigationregion3d-resources',
    });
  }

  return diagnostics;
}

const navigationRegion3DValidationRule: LintRule = {
  meta: {
    name: 'valid-navigationregion3d-resources',
    description: 'Validates NavigationRegion3D navigation_mesh reference resolves',
    category: 'validation',
    applicableNodeTypes: ['NavigationRegion3D'],
  },
  check: checkNavigationRegion3D,
};

ruleRegistry.register(navigationRegion3DValidationRule);

export { navigationRegion3DValidationRule };
