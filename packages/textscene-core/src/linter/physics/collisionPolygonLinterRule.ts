/**
 * Dimension-parameterized semantic linter rule for CollisionPolygon2D / CollisionPolygon3D.
 *
 * Both mirror their own class's get_configuration_warnings() —
 * collision_polygon_2d.cpp:232-257 and collision_polygon_3d.cpp:235-252 — and
 * every diagnostic in both is a WARNING; neither ever refuses a load, only
 * shows the editor's warning icon.
 *
 * Genuine dimension-specific seams: 2D's build-mode-dependent minimum vertex
 * count and its one-way-collision-ignored-under-Area2D check
 * (collision_polygon_2d.cpp:239-254) have no 3D equivalent —
 * collision_polygon_3d.cpp declares neither a build_mode nor a
 * one_way_collision property — and 3D's non-uniform-scale check
 * (collision_polygon_3d.cpp:246-249) has no 2D equivalent. Format validation
 * stays in each slice's linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { isValidProperties } from '../linterUtils.js';
import { parentTypeVerdict, verdictParent } from '../parentType.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { isZeroApprox } from '../../godot/math.js';
import { basisColumnScales } from './basisColumnScales.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { armEmits, reportArm, type RuleArm, type RuleArms } from '../ruleArms.js';
import { ruleInt } from '../validators/commonValidators.js';
import { polygonPointCount } from '../polygonPoints.js';

export function makeCollisionPolygonLinterRule(dim: PhysicsDim): LintRule {
  const type = `CollisionPolygon${dim}`;
  const prefix = `collisionpolygon${dimSuffix(dim)}`;
  const collisionObject = `CollisionObject${dim}`;
  const advice =
    `${type} only serves to provide a collision shape to a ${collisionObject} derived node. ` +
    `Please only use it as a child of Area${dim}, StaticBody${dim}, RigidBody${dim}, CharacterBody${dim}, etc. to give them a shape.`;

  // Each arm's enabling condition, stated once (see `ruleArms.ts`).
  const is2D = dim === '2D';
  const configWarning = { kind: 'configuration-warning' } as const;
  const arms: RuleArms<
    | 'noParent'
    | 'invalidParent'
    | 'emptyPolygon'
    | 'insufficientPoints'
    | 'oneWayIgnored'
    | 'nonUniformScale'
  > = {
    noParent: { severity: 'warning', ruleName: `${prefix}-no-parent`, grounding: configWarning },
    invalidParent: {
      severity: 'warning',
      ruleName: `${prefix}-invalid-parent`,
      grounding: configWarning,
    },
    emptyPolygon: {
      severity: 'warning',
      ruleName: `${prefix}-empty-polygon`,
      grounding: configWarning,
    },
    // 2D only: `collision_polygon_2d.cpp` carries the build-mode vertex count
    // and the one-way check, and the 3D file has neither property.
    insufficientPoints: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-insufficient-points`,
          grounding: configWarning,
        }
      : undefined,
    oneWayIgnored: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-one-way-ignored`,
          grounding: configWarning,
        }
      : undefined,
    // 3D only: `collision_polygon_2d.cpp`'s configuration warnings carry no
    // scale check at all.
    nonUniformScale: is2D
      ? undefined
      : { severity: 'warning', ruleName: `${prefix}-non-uniform-scale`, grounding: configWarning },
  };

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;
    if (!isValidProperties(node.properties)) return diagnostics;
    const rawProps = node.properties;
    const report = (arm: RuleArm | undefined, message: string) =>
      reportArm(diagnostics, arm, node, message);

    // collision_polygon_2d.cpp:235-237 / collision_polygon_3d.cpp:238-240 —
    // `!Object::cast_to<CollisionObject<dim>>(get_parent())`. The `unknowable`
    // arm is why this goes through the verdict: an instanced or override parent
    // declares its class in a scene this linter never opens, and measuring the
    // ExtResource ref against CollisionObject<dim> warns on every body built by
    // instancing one.
    const placement = parentTypeVerdict(scene, node, collisionObject);
    const parent = verdictParent(placement);
    if (placement.kind === 'root') {
      report(arms.noParent, `${type} '${node.name}' has no parent node. ${advice}`);
    } else if (placement.kind === 'mismatch') {
      report(arms.invalidParent, `${type} '${node.name}' has parent '${placement.parent.name}' of type '${placement.parent.type}', which is not a ${collisionObject}. ${advice}`);
    }

    // collision_polygon_2d.cpp:239-250 / collision_polygon_3d.cpp:242-244 —
    // empty polygon, then (2D only) a build-mode-dependent minimum vertex
    // count. The two are mutually exclusive in 2D's source (the count check
    // is in the `else` of the emptiness check), so at most one of them fires
    // there; 3D has no count check at all.
    const pointCount = polygonPointCount(rawProps.polygon);
    if (pointCount !== null) {
      if (pointCount === 0) {
        report(
          arms.emptyPolygon,
          is2D
            ? `${type} '${node.name}' has an empty polygon, which has no effect on collision.`
            : `${type} '${node.name}' has an empty polygon. An empty ${type} has no effect on collision.`
        );
      } else if (arms.insufficientPoints) {
        // build_mode default BUILD_SOLIDS = 0 (collision_polygon_2d.h:48);
        // absent key means the default, same as every other property this
        // codebase omits at default.
        const buildMode =
          ruleInt(rawProps.build_mode, 0);
        // Finite: every arm below compares against BUILD_SOLIDS, and a
        // non-finite passes both of them, naming a mode the file never states.
        if (buildMode !== null) {
          if (buildMode === 0 && pointCount < 3) {
            report(arms.insufficientPoints, `${type} '${node.name}' has an invalid polygon: at least 3 points are needed in 'Solids' build mode, got ${pointCount}.`);
          } else if (buildMode !== 0 && pointCount < 2) {
            report(arms.insufficientPoints, `${type} '${node.name}' has an invalid polygon: at least 2 points are needed in 'Segments' build mode, got ${pointCount}.`);
          }
        }
      }
    }

    // collision_polygon_2d.cpp:252-254 — `one_way_collision && Object::cast_to<Area2D>(get_parent())`.
    // No 3D equivalent: CollisionPolygon3D has no one_way_collision property.
    if (rawProps.one_way_collision === 'true' && parent && descendsFrom(parent.type, 'Area2D')) {
      report(arms.oneWayIgnored, `${type} '${node.name}' has 'one_way_collision' set, but its parent '${parent.name}' is an Area2D. The One Way Collision property will be ignored when the collision object is an Area2D.`);
    }

    // collision_polygon_3d.cpp:246-249 — non-uniform transform scale. No 2D
    // equivalent: collision_polygon_2d.cpp's get_configuration_warnings()
    // carries no scale check at all.
    if (arms.nonUniformScale && rawProps.transform !== undefined) {
      const scales = basisColumnScales(rawProps.transform);
      if (scales) {
        const [sx, sy, sz] = scales;
        if (!(isZeroApprox(sx - sy) && isZeroApprox(sy - sz))) {
          report(
            arms.nonUniformScale,
            `${type} '${node.name}' has a non-uniformly scaled transform ` +
              `(${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}), which will probably not ` +
              "function as expected. Keep its scale uniform and adjust the polygon's vertices instead."
          );
        }
      }
    }

    return diagnostics;
  }

  const description =
    dim === '2D'
      ? `Validates ${type} parent type, polygon vertex count against build mode, and one-way collision applicability`
      : `Validates ${type} parent node type, polygon emptiness, and transform scale uniformity`;

  return {
    meta: {
      name: `valid-${prefix}`,
      description,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
