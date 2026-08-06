/**
 * Semantic linter rule for NavigationObstacle2D: `carve_navigation_mesh` has
 * no effect unless `affect_navigation_mesh` is also enabled.
 *
 * `navmesh_parse_source_geometry` (navigation_obstacle_2d.cpp:356-414) returns
 * before `carve_navigation_mesh` is ever read:
 *
 *     if (!obstacle->get_affect_navigation_mesh()) {  // :363
 *         return;
 *     }
 *     ...
 *     p_source_geometry_data->add_projected_obstruction(..., obstacle->get_carve_navigation_mesh());  // :392, :413
 *
 * doc/classes/NavigationObstacle2D.xml states the same dependency in prose,
 * on `carve_navigation_mesh` itself: "Requires [member affect_navigation_mesh]
 * to be enabled." Advisory, hence a warning: the scene loads and both
 * properties are individually well-formed — `carve_navigation_mesh` is simply
 * dead configuration until `affect_navigation_mesh` is also on.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

const RULE = 'navigationobstacle2d-carve-without-affect';

function checkNavigationObstacle2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties;

  if (props.carve_navigation_mesh === 'true' && props.affect_navigation_mesh !== 'true') {
    return [
      {
        severity: 'warning',
        message: `NavigationObstacle2D '${node.name}' has 'carve_navigation_mesh' enabled but 'affect_navigation_mesh' is not. Navmesh baking checks 'affect_navigation_mesh' first and returns before carving is ever considered, so 'carve_navigation_mesh' has no effect.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: RULE,
      },
    ];
  }

  return [];
}

const navigationObstacle2DCarveRule: LintRule = {
  meta: {
    name: 'valid-navigationobstacle2d-carve-navigation-mesh',
    description:
      "Warns when NavigationObstacle2D's carve_navigation_mesh is enabled without affect_navigation_mesh, where it has no effect",
    category: 'validation',
    applicableNodeTypes: ['NavigationObstacle2D'],
    emits: [{ ruleName: RULE, severity: 'warning' }],
  },
  check: checkNavigationObstacle2D,
};

ruleRegistry.register(navigationObstacle2DCarveRule);

export { navigationObstacle2DCarveRule };
