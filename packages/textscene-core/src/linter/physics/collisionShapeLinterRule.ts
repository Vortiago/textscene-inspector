/**
 * The CollisionShape2D/3D rules. Only 2D checks the one-way pair, and only 3D checks
 * scale (collision_shape_3d.cpp:153-156), since collision_shape_2d.cpp's
 * get_configuration_warnings() carries no scale check. Format validation stays in
 * each slice's linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { resolveResourceSlot } from '../resourceChecker.js';
import { parentTypeVerdict, verdictParent } from '../parentType.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { isZeroApprox } from '../../godot/math.js';
import { basisColumnScales } from './basisColumnScales.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { armEmits, reportArm, type RuleArm, type RuleArms } from '../ruleArms.js';
import { parseGodotFloat } from '../validators/commonValidators.js';
import { boolSlotValue, descendsFromClass } from '../../godot/index.js';

export function makeCollisionShapeLinterRule(dim: PhysicsDim): LintRule {
  // `one_way_collision` carries PROPERTY_HINT_GROUP_ENABLE for the
  // `one_way_collision` group, so the margin beside it is inert while the
  // toggle is off. 2D only: CollisionShape3D declares neither property.
  const ONE_WAY_GROUP_AT = 'collision_shape_2d.cpp:290';
  const type = `CollisionShape${dim}`;
  const prefix = `collisionshape${dimSuffix(dim)}`;
  const collisionObject = `CollisionObject${dim}`;
  // Prose only. The check asks the base chain, because Godot's test is
  // `Object::cast_to<CollisionObject2D>(get_parent())` (collision_shape_2d.cpp:174),
  // not a list of names.
  const examples = ['Area', 'StaticBody', 'RigidBody', 'CharacterBody']
    .map((n) => n + dim)
    .join(', ');
  const advice = `${type} only gives a shape to a ${collisionObject}: use it under ${examples} or another subclass.`;

  // Each arm's enabling condition, stated once (see `ruleArms.ts`), in the
  // order the generated sheet lists them.
  const is2D = dim === '2D';
  const configWarning = { kind: 'configuration-warning' } as const;
  const arms: RuleArms<
    | 'requiresShape'
    | 'invalidParent'
    | 'noParent'
    | 'unusedOneWayMargin'
    | 'oneWayIgnoredUnderArea2D'
    | 'polygonShapeLimitedEditing'
    | 'nonUniformScale'
    | 'concaveUnderRigidBody'
    | 'worldBoundaryUnderRigidBody'
    | 'concaveUnderCharacterBody'
  > = {
    requiresShape: {
      severity: 'warning',
      ruleName: `${prefix}-requires-shape`,
      grounding: configWarning,
    },
    invalidParent: {
      severity: 'warning',
      ruleName: `${prefix}-invalid-parent`,
      grounding: configWarning,
    },
    noParent: { severity: 'warning', ruleName: `${prefix}-no-parent`, grounding: configWarning },
    // 2D only: `CollisionShape3D` declares neither one-way property, and the
    // polygon-editing advice is `collision_shape_2d.cpp:184-189`.
    unusedOneWayMargin: is2D
      ? {
          severity: 'info',
          ruleName: `${prefix}-unused-one-way-margin`,
          grounding: {
            kind: 'engine-inert',
            at: ONE_WAY_GROUP_AT,
            unused: 'the group-enable toggle gates the margin, which is read only while it is on',
          },
        }
      : undefined,
    oneWayIgnoredUnderArea2D: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-one-way-ignored-under-area2d`,
          grounding: configWarning,
        }
      : undefined,
    polygonShapeLimitedEditing: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-polygon-shape-limited-editing`,
          grounding: configWarning,
        }
      : undefined,
    // 3D only: `collision_shape_2d.cpp`'s configuration warnings carry neither
    // the scale check nor the shape-under-body pair.
    nonUniformScale: is2D
      ? undefined
      : { severity: 'warning', ruleName: `${prefix}-non-uniform-scale`, grounding: configWarning },
    concaveUnderRigidBody: is2D
      ? undefined
      : {
          severity: 'warning',
          ruleName: `${prefix}-concave-under-rigidbody`,
          grounding: configWarning,
        },
    worldBoundaryUnderRigidBody: is2D
      ? undefined
      : {
          severity: 'warning',
          ruleName: `${prefix}-worldboundary-under-rigidbody`,
          grounding: configWarning,
        },
    concaveUnderCharacterBody: is2D
      ? undefined
      : {
          severity: 'warning',
          ruleName: `${prefix}-concave-under-characterbody`,
          grounding: configWarning,
        },
  };

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;
    const report = (arm: RuleArm | undefined, message: string) =>
      reportArm(diagnostics, arm, node, message);
    const rawProps = node.properties as unknown as Record<string, string>;

    // One scan of the scene's resource tables for every question below: the
    // slot's state and, where it resolves, the shape class it names.
    const shape = resolveResourceSlot(scene, rawProps.shape);

    if (shape.kind === 'empty') {
      report(arms.requiresShape, `${type} '${node.name}' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry.`);
    }

    // Through the verdict for its `unknowable` arm: an instanced or override parent's
    // class is in a scene this linter never opens, so its `type` here is an
    // ExtResource ref or the index fallback's "0". Every later check reads this
    // parent, and each is silent without one.
    const placement = parentTypeVerdict(scene, node, collisionObject);
    const parent = verdictParent(placement);
    if (placement.kind === 'mismatch') {
      report(arms.invalidParent, `${type} '${node.name}' has parent '${placement.parent.name}' of type '${placement.parent.type}', which is not a ${collisionObject}. ${advice}`);
    } else if (placement.kind === 'root') {
      report(arms.noParent, `${type} '${node.name}' has no parent node. ${advice}`);
    }

    // 3D only, as collision_shape_2d.cpp has no equivalent. collision_shape_3d.cpp:135-149:
    // `cast_to<RigidBody3D>(col_object)` passes for VehicleBody3D too, so Godot's message
    // picks `body_type` from a nested cast. The push ignores freeze and freeze_mode.
    if (arms.concaveUnderRigidBody && parent && shape.kind === 'resolved') {
      if (descendsFrom(parent.type, 'RigidBody3D')) {
        const bodyType = descendsFrom(parent.type, 'VehicleBody3D') ? 'VehicleBody3D' : 'RigidBody3D';
        // `descendsFromClass`: `cast_to<ConcavePolygonShape3D>` (:140, :142) passes for
        // a subclass, and only the merged node and resource table holds a Shape's ancestry.
        if (descendsFromClass(shape.type, 'ConcavePolygonShape3D')) {
          report(arms.concaveUnderRigidBody, `${type} '${node.name}' uses a ConcavePolygonShape3D under a ${bodyType} ('${parent.name}'). ` +
              `ConcavePolygonShape3D is intended for static bodies like StaticBody3D and will likely not ` +
              `behave well for a ${bodyType}, except when frozen with freeze_mode set to Static.`
          );
        } else if (descendsFromClass(shape.type, 'WorldBoundaryShape3D')) {
          report(arms.worldBoundaryUnderRigidBody, `${type} '${node.name}' uses a WorldBoundaryShape3D under a ${bodyType} ('${parent.name}'). ` +
              `WorldBoundaryShape3D doesn't support ${bodyType} in a non-static mode.`
          );
        }
      } else if (
        descendsFrom(parent.type, 'CharacterBody3D') &&
        descendsFromClass(shape.type, 'ConcavePolygonShape3D')
      ) {
        report(arms.concaveUnderCharacterBody, `${type} '${node.name}' uses a ConcavePolygonShape3D under a CharacterBody3D ('${parent.name}'). ` +
            `ConcavePolygonShape3D is intended for static bodies like StaticBody3D and will likely not ` +
            `behave well for a CharacterBody3D.`
        );
      }
    }

    // Non-uniform scale, 3D only: collision_shape_2d.cpp has no equivalent.
    if (arms.nonUniformScale && rawProps.transform !== undefined) {
      const scales = basisColumnScales(rawProps.transform);
      if (scales) {
        const [sx, sy, sz] = scales;
        if (!(isZeroApprox(sx - sy) && isZeroApprox(sy - sz))) {
          report(arms.nonUniformScale, `${type} '${node.name}' has a non-uniformly scaled transform ` +
              `(${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}), which will probably not ` +
              'function as expected. Keep its scale uniform and change the size of its shape resource instead.'
          );
        }
      }
    }

    // One Way Collision is ignored under an Area2D, which has no solid faces (2D only,
    // collision_shape_2d.cpp:182, `one_way_collision && cast_to<Area2D>(col_object)`).
    // This fires on the flag under an Area2D parent. `unused-one-way-margin` fires on a
    // margin without the flag, whatever the parent.
    if (boolSlotValue(rawProps.one_way_collision) === true && parent && descendsFrom(parent.type, 'Area2D')) {
      report(arms.oneWayIgnoredUnderArea2D, `${type} '${node.name}' has 'one_way_collision' enabled under an Area2D ('${parent.name}'). One Way Collision is ignored when the collision object is an Area2D.`);
    }

    // A polygon-based Shape2D has limited editing (2D only: collision_shape_2d.cpp:185-187
    // assigns the slot into a `Ref<...PolygonShape2D>` and tests `is_valid()`, a cast a
    // subclass passes).
    if (
      shape.kind === 'resolved' &&
      (descendsFromClass(shape.type, 'ConvexPolygonShape2D') ||
        descendsFromClass(shape.type, 'ConcavePolygonShape2D'))
    ) {
      report(arms.polygonShapeLimitedEditing, `${type} '${node.name}' uses a ${shape.type}, which has limited editing options in CollisionShape2D. Consider using a CollisionPolygon2D node instead.`);
    }

    // one_way_collision_margin set but one_way_collision is false (2D only)
    if (rawProps.one_way_collision_margin && boolSlotValue(rawProps.one_way_collision) !== true) {
      const margin = parseGodotFloat(rawProps.one_way_collision_margin);
      if (margin !== null && margin > 0) {
        report(arms.unusedOneWayMargin, `${type} '${node.name}' has 'one_way_collision_margin' set to ${margin}, but 'one_way_collision' is ${rawProps.one_way_collision || 'not set (defaults to false)'}. The margin will have no effect unless 'one_way_collision' is true.`);
      }
    }

    return diagnostics;
  }

  const description =
    dim === '2D'
      ? `Validates ${type} shape resource references, parent node types, and one-way collision configuration`
      : `Validates ${type} shape resource references, parent node types, and transform scale uniformity`;

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
