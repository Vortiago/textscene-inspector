/**
 * The NavigationObstacle2D/3D rules. `carve_navigation_mesh` is dead configuration
 * while `affect_navigation_mesh` is off, as doc/classes/NavigationObstacle{2D,3D}.xml
 * say: "Requires [member affect_navigation_mesh] to be enabled." The scene loads and
 * both properties are well-formed, so that report is advisory.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { isValidProperties } from '../linterUtils.js';
import { resolveGlobalTransform2D } from '../node2dGlobalTransform.js';
import { parseGodotFloat } from '../validators/commonValidators.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { armEmits, reportArm, type RuleArm, type RuleArms } from '../ruleArms.js';
import {
  boolSlotValue,
  transform2DGetScale,
  transform2DHasZeroSkew,
  transform2DIsConformal,
} from '../../godot/index.js';

/**
 * `navigation_obstacle_2d.cpp:332`, the floor `get_global_scale()` must clear on both
 * axes. The same literal floors the safe scale `get_global_scale().abs().maxf(0.001)`
 * at `:254`, `:367`, `:431`, `:445`. It stays local: `src/godot/` admits a fact only
 * when a second domain needs it.
 */
const MIN_GLOBAL_SCALE = 0.001;

export function makeNavigationObstacleLinterRule(dim: PhysicsDim): LintRule {
  // `navmesh_parse_source_geometry` returns while `affect_navigation_mesh` is off,
  // before reading `carve_navigation_mesh`: navigation_obstacle_2d.cpp:363 (carve read
  // at :392 and :413) and navigation_obstacle_3d.cpp:443 (carve read at :474 and :496).
  const CARVE_GATE_AT =
    dim === '2D' ? 'navigation_obstacle_2d.cpp:363' : 'navigation_obstacle_3d.cpp:443';
  const type = `NavigationObstacle${dim}`;
  const prefix = `navigationobstacle${dimSuffix(dim)}`;

  // Each arm's enabling condition, stated once (see `ruleArms.ts`).
  const is2D = dim === '2D';
  const configWarning = { kind: 'configuration-warning' } as const;
  const arms: RuleArms<'carveWithoutAffect' | 'nonPositiveScale' | 'nonUniformScale' | 'skew'> = {
    carveWithoutAffect: {
      severity: 'info',
      ruleName: `${prefix}-carve-without-affect`,
      grounding: {
        kind: 'engine-inert',
        at: CARVE_GATE_AT,
        unused: 'the source-geometry parser returns before it reads carve_navigation_mesh',
      },
    },
    // The global-transform warnings are 2D only: `NavigationObstacle2D::get_configuration_warnings()`
    // (navigation_obstacle_2d.cpp:328-345), read through `node2dGlobalTransform.ts`'s
    // static ancestor walk.
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

    if (boolSlotValue(props.carve_navigation_mesh) === true && boolSlotValue(props.affect_navigation_mesh) !== true) {
      report(arms.carveWithoutAffect, `${type} '${node.name}' has 'carve_navigation_mesh' enabled but 'affect_navigation_mesh' is not. Navmesh baking checks 'affect_navigation_mesh' first and returns before carving is ever considered, so 'carve_navigation_mesh' has no effect.`);
    }

    // Not ported: NavigationObstacle3D's warnings (navigation_obstacle_3d.cpp:408-425)
    // on non-y-axis global rotation and non-positive or non-uniform global scale, declined
    // as runtime-only in the coverage table. Node3D serialises one `transform`, which
    // needs a Transform3D composition the 2D helper does not do.
    if (arms.nonPositiveScale) {
      const verdict = resolveGlobalTransform2D(scene, node);
      if (verdict.kind === 'known') {
        const scale = transform2DGetScale(verdict.transform);

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
          if (!transform2DIsConformal(verdict.transform)) {
            report(arms.nonUniformScale, `${type} '${node.name}' has radius ${radius} but a non-uniformly-scaled global transform. The agent radius can only be scaled uniformly; the largest value along the two axes of the global scale will be used to scale the radius, which may change in unexpected ways when the node is rotated.`);
          }

          // navigation_obstacle_2d.cpp:340-342
          if (!transform2DHasZeroSkew(verdict.transform)) {
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
      description: `Flags ${type}'s carve_navigation_mesh enabled without affect_navigation_mesh, where it has no effect`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
