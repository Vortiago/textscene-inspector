/**
 * Dimension-parameterized semantic linter rule for NavigationRegion2D / NavigationRegion3D.
 *
 * The genuine dimension-specific seam is the navigation resource property:
 * 2D references a `navigation_polygon`, 3D a `navigation_mesh`. The reference
 * is optional in general — `bake_navigation_mesh` (navigation_region_2d.cpp,
 * navigation_region_3d.cpp) both open with an `ERR_FAIL_COND_MSG` on a null
 * resource, so Godot does NOT bake one at runtime; an absent reference is only
 * unflagged where the engine's own check gates it (see the 2D-only branch
 * below).
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import { visibleInTreeVerdict } from '../parentType.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeNavigationRegionLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationRegion${dim}`;
  const resourceRuleName = `valid-navigationregion${dimSuffix(dim)}-resources`;
  const missingPolygonRuleName = `navigationregion${dimSuffix(dim)}-requires-navigation-polygon`;
  const property = dim === '2D' ? 'navigation_polygon' : 'navigation_mesh';
  const noun = dim === '2D' ? 'polygon' : 'mesh';

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;


    const rawProps = node.properties as unknown as Record<string, string>;

    const ref = rawProps[property];
    if (!ref) {
      // navigation_region_2d.cpp:302-306: gated on `is_visible_in_tree() &&
      // is_inside_tree()`. `is_inside_tree()` is trivially true for any node
      // this linter sees; `is_visible_in_tree()` needs the ancestor walk.
      // Kept 2D-only: the 3D counterpart (navigation_region_3d.cpp:255-259)
      // is declined in the coverage table as runtime-only, since crossing an
      // `instance=` boundary there is common enough to leave it out rather
      // than half-answer it.
      if (dim === '2D' && visibleInTreeVerdict(scene, node) === 'visible') {
        diagnostics.push({
          severity: 'warning',
          message: `NavigationRegion2D '${node.name}' has no navigation_polygon set. A NavigationPolygon resource must be set or created for this node to work.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: missingPolygonRuleName,
        });
      }
      return diagnostics;
    }

    if (!checkResourceExists(scene, ref)) {
      diagnostics.push({
        severity: 'error',
        message: `Navigation ${noun} resource not found: ${ref} (${property})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: resourceRuleName,
      });
    }

    return diagnostics;
  }

  return {
    meta: {
      name: resourceRuleName,
      description: `Validates ${type} ${property} reference resolves${dim === '2D' ? ', and warns when it is absent while visible' : ''}`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: resourceRuleName, severity: 'error' },
        // 2D-only branch (dim === '2D'); never emitted by the 3D instantiation
        ...(dim === '2D' ? [{ ruleName: missingPolygonRuleName, severity: 'warning' as const }] : []),
      ],
    },
    check,
  };
}
