/**
 * Dimension-parameterized semantic linter rule for NavigationObstacle2D / NavigationObstacle3D.
 *
 * Both dimensions gate the same way: `navmesh_parse_source_geometry` returns
 * before `carve_navigation_mesh` is ever read once `affect_navigation_mesh`
 * is off.
 *
 *   2D — navigation_obstacle_2d.cpp:363 (`if (!obstacle->get_affect_navigation_mesh()) return;`),
 *        carve read at :392 and :413.
 *   3D — navigation_obstacle_3d.cpp:443 (identical early return),
 *        carve read at :474 and :496.
 *
 * doc/classes/NavigationObstacle{2D,3D}.xml both state the dependency in
 * prose on `carve_navigation_mesh` itself: "Requires [member
 * affect_navigation_mesh] to be enabled." Advisory, hence a warning — the
 * scene loads and both properties are individually well-formed;
 * `carve_navigation_mesh` is simply dead configuration until
 * `affect_navigation_mesh` is also on.
 *
 * NOT ported here: NavigationObstacle3D's `get_configuration_warnings()`
 * (navigation_obstacle_3d.cpp:408-425) also warns on non-y-axis GLOBAL
 * rotation, zero/negative GLOBAL scale, and non-uniform GLOBAL scale with a
 * radius set; NavigationObstacle2D's (navigation_obstacle_2d.cpp:328-345)
 * warns on zero/negative GLOBAL scale, non-uniform GLOBAL scale with a radius
 * set, and skew with a radius set — three conditions each, none shared
 * verbatim (2D has no rotation check, 3D has no skew check). Every one of
 * them reads `get_global_*` state, which requires walking the node's full
 * ancestor chain to compute. That is unlike CollisionShape3D's non-uniform
 * -scale check (collision_shape_3d.cpp:153, plain `get_transform()`, LOCAL
 * to the node's own serialized `transform` property) — this linter has no
 * ancestor-chain walk, so none of the six conditions are statically
 * derivable from a single node's own properties the way this rule's gate is.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { isValidProperties } from '../linterUtils.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeNavigationObstacleLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationObstacle${dim}`;
  const prefix = `navigationobstacle${dimSuffix(dim)}`;
  const ruleName = `${prefix}-carve-without-affect`;

  function check(context: RuleContext): Diagnostic[] {
    const { node } = context;
    if (!isValidProperties(node.properties)) return [];
    const props = node.properties;

    if (props.carve_navigation_mesh === 'true' && props.affect_navigation_mesh !== 'true') {
      return [
        {
          severity: 'warning',
          message: `${type} '${node.name}' has 'carve_navigation_mesh' enabled but 'affect_navigation_mesh' is not. Navmesh baking checks 'affect_navigation_mesh' first and returns before carving is ever considered, so 'carve_navigation_mesh' has no effect.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName,
        },
      ];
    }

    return [];
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Warns when ${type}'s carve_navigation_mesh is enabled without affect_navigation_mesh, where it has no effect`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [{ ruleName, severity: 'warning' }],
    },
    check,
  };
}
