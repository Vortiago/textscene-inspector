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
 * The 2D instantiation ALSO carries `NavigationObstacle2D::get_configuration_warnings()`
 * (navigation_obstacle_2d.cpp:328-345), via `node2dGlobalTransform.ts`'s static
 * ancestor-transform walk — see that module's docblock for exactly what it
 * composes and where it gives up:
 *
 *     const Vector2 global_scale = get_global_scale();
 *     if (global_scale.x < 0.001 || global_scale.y < 0.001) { ... }                      // :331-333
 *     if (radius > 0.0 && !get_global_transform().is_conformal()) { ... }                // :336-338
 *     if (radius > 0.0 && get_global_skew() != 0.0) { ... }                              // :340-342
 *
 * NOT ported here: NavigationObstacle3D's `get_configuration_warnings()`
 * (navigation_obstacle_3d.cpp:408-425) warns on non-y-axis GLOBAL rotation,
 * zero/negative GLOBAL scale, and non-uniform GLOBAL scale with a radius set —
 * declined as runtime-only in this repo's coverage table. The 3D twin needs a
 * Transform3D composition this helper does not do — Node3D serialises one
 * `transform` where Node2D serialises position/rotation/scale/skew separately —
 * so answering it is a real piece of work, not a call away.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { isValidProperties } from '../linterUtils.js';
import {
  resolveGlobalTransform2D,
  globalScale,
  isConformal,
  hasZeroGlobalSkew,
} from '../node2dGlobalTransform.js';
import { parseGodotFloat } from '../validators/commonValidators.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { armEmits, reportArm, type RuleArm, type RuleArms } from '../ruleArms.js';

/**
 * `navigation_obstacle_2d.cpp:332`, the floor `get_global_scale()` must clear
 * on both axes. The SAME literal also floors the "safe scale" `get_global_scale().abs().maxf(0.001)`
 * used at `:254`, `:367`, `:431`, `:445` — a single magic number, not
 * independently chosen per call site. It stays local all the same: `src/godot/`
 * admits a fact only when more than one DOMAIN needs it, and this one has a
 * single consumer. Move it there when a second turns up, not before.
 */
const MIN_GLOBAL_SCALE = 0.001;

export function makeNavigationObstacleLinterRule(dim: PhysicsDim): LintRule {
  // The `affect_navigation_mesh` early return, per dimension: the two families
  // gate in their own source parser, so one literal cannot stand for both.
  const CARVE_GATE_AT =
    dim === '2D' ? 'navigation_obstacle_2d.cpp:363' : 'navigation_obstacle_3d.cpp:443';
  const type = `NavigationObstacle${dim}`;
  const prefix = `navigationobstacle${dimSuffix(dim)}`;

  // Each arm's enabling condition, stated once (see `ruleArms.ts`).
  const is2D = dim === '2D';
  const configWarning = { kind: 'configuration-warning' } as const;
  const arms: RuleArms<'carveWithoutAffect' | 'nonPositiveScale' | 'nonUniformScale' | 'skew'> = {
    carveWithoutAffect: {
      severity: 'warning',
      ruleName: `${prefix}-carve-without-affect`,
      grounding: {
        kind: 'engine-inert',
        at: CARVE_GATE_AT,
        unused: 'the source-geometry parser returns before it reads carve_navigation_mesh',
      },
    },
    // The global transform is a 2D concern only: `NavigationObstacle2D` guards
    // it in `get_configuration_warnings`, and the 3D class has no equivalent.
    nonPositiveScale: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-non-positive-global-scale`,
          grounding: configWarning,
        }
      : undefined,
    nonUniformScale: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-non-uniform-global-scale`,
          grounding: configWarning,
        }
      : undefined,
    skew: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-global-skew-ignored`,
          grounding: configWarning,
        }
      : undefined,
  };

  function check(context: RuleContext): Diagnostic[] {
    const { node, scene } = context;
    const diagnostics: Diagnostic[] = [];
    if (!isValidProperties(node.properties)) return diagnostics;
    const props = node.properties;
    const report = (arm: RuleArm | undefined, message: string) =>
      reportArm(diagnostics, arm, node, message);

    if (props.carve_navigation_mesh === 'true' && props.affect_navigation_mesh !== 'true') {
      report(arms.carveWithoutAffect, `${type} '${node.name}' has 'carve_navigation_mesh' enabled but 'affect_navigation_mesh' is not. Navmesh baking checks 'affect_navigation_mesh' first and returns before carving is ever considered, so 'carve_navigation_mesh' has no effect.`);
    }

    if (arms.nonPositiveScale) {
      const verdict = resolveGlobalTransform2D(scene, node);
      if (verdict.kind === 'known') {
        const scale = globalScale(verdict.transform);

        // navigation_obstacle_2d.cpp:331-333
        if (scale.x < MIN_GLOBAL_SCALE || scale.y < MIN_GLOBAL_SCALE) {
          report(arms.nonPositiveScale, `${type} '${node.name}' has global scale (${scale.x.toFixed(3)}, ${scale.y.toFixed(3)}). NavigationObstacle2D does not support negative or zero scaling.`);
        }

        // radius > 0.0 gate: navigation_obstacle_2d.h:46 defaults radius to
        // 0.0, so a bare node never reaches either of the next two checks.
        const radius = props.radius !== undefined ? parseGodotFloat(props.radius) : 0;
        // No finiteness guard: `set_radius` has none either, so `inf` is a
        // radius the obstacle holds and both warnings below apply to it.
        // `nan > 0` is false in JS exactly as in C++.
        if (radius !== null && radius > 0) {
          // navigation_obstacle_2d.cpp:336-338
          if (!isConformal(verdict.transform)) {
            report(arms.nonUniformScale, `${type} '${node.name}' has radius ${radius} but a non-uniformly-scaled global transform. The agent radius can only be scaled uniformly; the largest value along the two axes of the global scale will be used to scale the radius, which may change in unexpected ways when the node is rotated.`);
          }

          // navigation_obstacle_2d.cpp:340-342
          if (!hasZeroGlobalSkew(verdict.transform)) {
            report(arms.skew, `${type} '${node.name}' has radius ${radius} but a skewed global transform. Skew has no effect on the agent radius.`);
          }
        }
      }
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Warns when ${type}'s carve_navigation_mesh is enabled without affect_navigation_mesh, where it has no effect`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
