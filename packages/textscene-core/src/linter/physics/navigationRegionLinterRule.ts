/**
 * The NavigationRegion2D/3D warning for an absent navigation resource:
 * `navigation_polygon` in 2D, `navigation_mesh` in 3D. Both `bake_navigation_mesh`
 * (navigation_region_2d.cpp, navigation_region_3d.cpp) open with an
 * `ERR_FAIL_COND_MSG` on a null resource, so neither is baked for you.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../ruleArms.js';
import { resourceSlotIsEmpty } from '../resourceChecker.js';
import { hiddenOrUnknowableInTree } from '../parentType.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeNavigationRegionLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationRegion${dim}`;
  const property = dim === '2D' ? 'navigation_polygon' : 'navigation_mesh';
  const resourceClass = dim === '2D' ? 'NavigationPolygon' : 'NavigationMesh';
  const arms = {
    missingResource: groundedArm(
      `navigationregion${dimSuffix(dim)}-requires-${property.replace(/_/g, '-')}`,
      { kind: 'configuration-warning' }
    ),
  } as const satisfies RuleArms<string>;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    // navigation_region_2d.cpp:302-306 and navigation_region_3d.cpp:255-259,
    // the same check twice: gated on `is_visible_in_tree() &&
    // is_inside_tree()`. `is_inside_tree()` is trivially true for any node
    // this linter sees; the visibility half walks each family's own chain.
    if (resourceSlotIsEmpty(node.rawProperties[property]) && !hiddenOrUnknowableInTree(scene, node)) {
      reportArm(
        diagnostics,
        arms.missingResource,
        node,
        `${type} '${node.name}' has no ${property} set. A ${resourceClass} resource must be set or created for this node to work.`
      );
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-navigationregion${dimSuffix(dim)}-resources`,
      description: `Warns when a ${type}'s ${property} is absent while visible`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
