/**
 * Dimension-parameterized semantic linter rule for NavigationRegion2D / NavigationRegion3D.
 *
 * The genuine dimension-specific seam is the navigation resource property:
 * 2D references a `navigation_polygon`, 3D a `navigation_mesh`. The reference is
 * optional — an absent reference must not be flagged (Godot bakes one at runtime).
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeNavigationRegionLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationRegion${dim}`;
  const ruleName = `valid-navigationregion${dimSuffix(dim)}-resources`;
  const property = dim === '2D' ? 'navigation_polygon' : 'navigation_mesh';
  const noun = dim === '2D' ? 'polygon' : 'mesh';

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    const rawProps = node.properties as unknown as Record<string, string>;

    const ref = rawProps[property];
    if (!ref) {
      return diagnostics;
    }

    if (!checkResourceExists(scene, ref)) {
      diagnostics.push({
        severity: 'error',
        message: `Navigation ${noun} resource not found: ${ref} (${property})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName,
      });
    }

    return diagnostics;
  }

  return {
    meta: {
      name: ruleName,
      description: `Validates ${type} ${property} reference resolves`,
      category: 'validation',
      applicableNodeTypes: [type],
    },
    check,
  };
}
