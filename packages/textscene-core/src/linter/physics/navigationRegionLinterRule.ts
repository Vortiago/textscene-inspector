/**
 * Dimension-parameterized semantic linter rule for NavigationRegion2D / NavigationRegion3D.
 *
 * The genuine dimension-specific seam is the navigation resource property:
 * 2D references a `navigation_polygon`, 3D a `navigation_mesh`. Neither is
 * baked for you — `bake_navigation_mesh` (navigation_region_2d.cpp,
 * navigation_region_3d.cpp) both open with an `ERR_FAIL_COND_MSG` on a null
 * resource — and both overrides raise the same configuration warning for an
 * absent one, behind the same visibility gate.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists, heldResource } from '../resourceChecker.js';
import { hiddenOrUnknowableInTree } from '../parentType.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeNavigationRegionLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationRegion${dim}`;
  const resourceRuleName = `valid-navigationregion${dimSuffix(dim)}-resources`;
  const property = dim === '2D' ? 'navigation_polygon' : 'navigation_mesh';
  const missingResourceRuleName = `navigationregion${dimSuffix(dim)}-requires-${property.replace(/_/g, '-')}`;
  const noun = dim === '2D' ? 'polygon' : 'mesh';
  const resourceClass = dim === '2D' ? 'NavigationPolygon' : 'NavigationMesh';

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;


    const rawProps = node.properties as unknown as Record<string, string>;

    const ref = heldResource(rawProps[property]);
    if (ref === undefined) {
      // navigation_region_2d.cpp:302-306 and navigation_region_3d.cpp:255-259,
      // the same check twice: gated on `is_visible_in_tree() &&
      // is_inside_tree()`. `is_inside_tree()` is trivially true for any node
      // this linter sees; the visibility half walks each family's own chain.
      if (!hiddenOrUnknowableInTree(scene, node)) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has no ${property} set. A ${resourceClass} resource must be set or created for this node to work.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: missingResourceRuleName,
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
      description: `Validates ${type} ${property} reference resolves, and warns when it is absent while visible`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        {
          ruleName: resourceRuleName,
          severity: 'error',
          grounding: {
            kind: 'no-engine-counterpart',
            scope: 'dangling-reference',
            because: `the ${property} id is not declared anywhere in this file`,
          },
        },
        {
          ruleName: missingResourceRuleName,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
      ],
    },
    check,
  };
}
