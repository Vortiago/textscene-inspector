/**
 * Dimension-parameterized semantic linter rule for CollisionShape2D / CollisionShape3D.
 *
 * Genuine dimension-specific seams: the valid parent-body types (3D adds
 * VehicleBody3D), a 2D-only `one_way_collision_margin` check, and a 3D-only
 * non-uniform-scale check — collision_shape_3d.cpp:153-156 has no 2D
 * equivalent (collision_shape_2d.cpp's get_configuration_warnings() carries
 * no scale check at all). Format validation stays in each slice's
 * linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { resolveResourceSlot } from '../resourceChecker.js';
import { parentTypeVerdict, verdictParent } from '../parentType.js';
import { descendsFrom } from '../nodeBaseTypes.js';
import { isZeroApprox } from '../../godot/math.js';
import { basisColumnScales } from './basisColumnScales.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { armEmits, reportArm, type RuleArms } from '../ruleArms.js';
import { parseGodotFloat } from '../validators/commonValidators.js';

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

  // Every arm, stated once, in the order the generated sheet lists them.
  // `emits` is derived from this record and `check` reports through it, so a
  // dimension-specific arm cannot become reachable for the sibling
  // instantiation without also being declared by it — a divergence no emits
  // guard can see, because the sibling's own declaration satisfies the
  // wildcard cross-checks on its behalf.
  const configWarning = { kind: 'configuration-warning' } as const;
  const arms: RuleArms<
    | 'requiresShape'
    | 'danglingShape'
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
    danglingShape: {
      severity: 'error',
      ruleName: `valid-${prefix}-resources`,
      grounding: {
        kind: 'no-engine-counterpart',
        scope: 'dangling-reference',
        because: 'the shape id is not declared anywhere in this file',
      },
    },
    invalidParent: {
      severity: 'warning',
      ruleName: `${prefix}-invalid-parent`,
      grounding: configWarning,
    },
    noParent: { severity: 'warning', ruleName: `${prefix}-no-parent`, grounding: configWarning },
    // 2D only: `CollisionShape3D` declares neither one-way property, and the
    // polygon-editing advice is `collision_shape_2d.cpp:184-189`.
    ...(dim === '2D'
      ? {
          unusedOneWayMargin: {
            severity: 'warning' as const,
            ruleName: `${prefix}-unused-one-way-margin`,
            grounding: {
              kind: 'engine-inert',
              at: ONE_WAY_GROUP_AT,
              unused:
                'the group-enable toggle gates the margin, which is read only while it is on',
            } as const,
          },
          oneWayIgnoredUnderArea2D: {
            severity: 'warning' as const,
            ruleName: `${prefix}-one-way-ignored-under-area2d`,
            grounding: configWarning,
          },
          polygonShapeLimitedEditing: {
            severity: 'warning' as const,
            ruleName: `${prefix}-polygon-shape-limited-editing`,
            grounding: configWarning,
          },
        }
      : {}),
    // 3D only: `collision_shape_2d.cpp`'s configuration warnings carry neither
    // the scale check nor the shape-under-body pair.
    ...(dim === '3D'
      ? {
          nonUniformScale: {
            severity: 'warning' as const,
            ruleName: `${prefix}-non-uniform-scale`,
            grounding: configWarning,
          },
          concaveUnderRigidBody: {
            severity: 'warning' as const,
            ruleName: `${prefix}-concave-under-rigidbody`,
            grounding: configWarning,
          },
          worldBoundaryUnderRigidBody: {
            severity: 'warning' as const,
            ruleName: `${prefix}-worldboundary-under-rigidbody`,
            grounding: configWarning,
          },
          concaveUnderCharacterBody: {
            severity: 'warning' as const,
            ruleName: `${prefix}-concave-under-characterbody`,
            grounding: configWarning,
          },
        }
      : {}),
  };

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // One scan of the scene's resource tables for every question below: the
    // slot's state and, where it resolves, the shape class it names.
    const shape = resolveResourceSlot(scene, rawProps.shape);

    if (shape.kind === 'empty') {
      reportArm(
        diagnostics,
        arms.requiresShape,
        node,
        `${type} '${node.name}' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry.`
      );
    } else if (shape.kind === 'dangling') {
      // Only a well-formed reference can be missing. A `not-a-reference` value
      // names no id, and its format is the strict parser's diagnostic.
      reportArm(
        diagnostics,
        arms.danglingShape,
        node,
        `Shape resource not found: ${rawProps.shape}. The referenced shape resource must exist in the scene.`
      );
    }

    // WARNING: Check if parent is a valid physics body type. Through the
    // verdict for its `unknowable` arm: an instanced or override parent takes
    // its class from a scene this linter never opens, so its `type` here is an
    // ExtResource ref or the index fallback's "0", and comparing either against
    // a CollisionObject warns on every body assembled by instancing one. Every
    // later check below reads the same parent, and each is silent without one.
    const placement = parentTypeVerdict(scene, node, collisionObject);
    const parent = verdictParent(placement);
    if (placement.kind === 'mismatch') {
      reportArm(
        diagnostics,
        arms.invalidParent,
        node,
        `${type} '${node.name}' has parent '${placement.parent.name}' of type '${placement.parent.type}', which is not a ${collisionObject}. ${advice}`
      );
    } else if (placement.kind === 'root') {
      reportArm(
        diagnostics,
        arms.noParent,
        node,
        `${type} '${node.name}' has no parent node. ${advice}`
      );
    }

    // WARNING: ConcavePolygonShape3D / WorldBoundaryShape3D under a body they
    // do not suit (3D only — collision_shape_2d.cpp has no equivalent check).
    // collision_shape_3d.cpp:135-149: `Object::cast_to<RigidBody3D>(col_object)`
    // succeeds for VehicleBody3D too (it extends RigidBody3D), which is why
    // Godot's own message picks `body_type` from a nested VehicleBody3D cast.
    // The push is UNCONDITIONAL on freeze/freeze_mode — "except when frozen" in
    // Godot's own string is message prose, not part of the guard.
    if (arms.concaveUnderRigidBody && parent && shape.kind === 'resolved') {
      if (descendsFrom(parent.type, 'RigidBody3D')) {
        const bodyType = descendsFrom(parent.type, 'VehicleBody3D') ? 'VehicleBody3D' : 'RigidBody3D';
        if (shape.type === 'ConcavePolygonShape3D') {
          reportArm(
            diagnostics,
            arms.concaveUnderRigidBody,
            node,
            `${type} '${node.name}' uses a ConcavePolygonShape3D under a ${bodyType} ('${parent.name}'). ` +
              `ConcavePolygonShape3D is intended for static bodies like StaticBody3D and will likely not ` +
              `behave well for a ${bodyType}, except when frozen with freeze_mode set to Static.`
          );
        } else if (shape.type === 'WorldBoundaryShape3D') {
          reportArm(
            diagnostics,
            arms.worldBoundaryUnderRigidBody,
            node,
            `${type} '${node.name}' uses a WorldBoundaryShape3D under a ${bodyType} ('${parent.name}'). ` +
              `WorldBoundaryShape3D doesn't support ${bodyType} in a non-static mode.`
          );
        }
      } else if (
        descendsFrom(parent.type, 'CharacterBody3D') &&
        shape.type === 'ConcavePolygonShape3D'
      ) {
        reportArm(
          diagnostics,
          arms.concaveUnderCharacterBody,
          node,
          `${type} '${node.name}' uses a ConcavePolygonShape3D under a CharacterBody3D ('${parent.name}'). ` +
            `ConcavePolygonShape3D is intended for static bodies like StaticBody3D and will likely not ` +
            `behave well for a CharacterBody3D.`
        );
      }
    }

    // WARNING: non-uniform scale (3D only — collision_shape_2d.cpp's
    // get_configuration_warnings() has no equivalent check)
    if (arms.nonUniformScale && rawProps.transform !== undefined) {
      const scales = basisColumnScales(rawProps.transform);
      if (scales) {
        const [sx, sy, sz] = scales;
        if (!(isZeroApprox(sx - sy) && isZeroApprox(sy - sz))) {
          reportArm(
            diagnostics,
            arms.nonUniformScale,
            node,
            `${type} '${node.name}' has a non-uniformly scaled transform ` +
              `(${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}), which will probably not ` +
              'function as expected. Keep its scale uniform and change the size of its shape resource instead.'
          );
        }
      }
    }

    // WARNING: One Way Collision is ignored under an Area2D (2D only —
    // collision_shape_2d.cpp:182, `one_way_collision && cast_to<Area2D>(col_object)`).
    // Distinct from the `unused-one-way-margin` check below: that one fires
    // regardless of parent type when the margin is set without the flag; this
    // one fires on the flag itself, gated on the PARENT being an Area2D, which
    // ignores one-way collision entirely (it has no solid faces to be one-way about).
    if (
      rawProps.one_way_collision === 'true' &&
      parent &&
      descendsFrom(parent.type, 'Area2D')
    ) {
      reportArm(
        diagnostics,
        arms.oneWayIgnoredUnderArea2D,
        node,
        `${type} '${node.name}' has 'one_way_collision' enabled under an Area2D ('${parent.name}'). One Way Collision is ignored when the collision object is an Area2D.`
      );
    }

    // WARNING: shape resolves to a polygon-based Shape2D with limited editing
    // (2D only — collision_shape_2d.cpp:184-189).
    if (shape.kind === 'resolved') {
      if (shape.type === 'ConvexPolygonShape2D' || shape.type === 'ConcavePolygonShape2D') {
        reportArm(
          diagnostics,
          arms.polygonShapeLimitedEditing,
          node,
          `${type} '${node.name}' uses a ${shape.type}, which has limited editing options in CollisionShape2D. Consider using a CollisionPolygon2D node instead.`
        );
      }
    }

    // WARNING: one_way_collision_margin set but one_way_collision is false (2D only)
    if (rawProps.one_way_collision_margin && rawProps.one_way_collision !== 'true') {
      const margin = parseGodotFloat(rawProps.one_way_collision_margin);
      // Only warn if margin is non-zero and one_way_collision is explicitly false or not set
      if (margin !== null && margin > 0) {
        reportArm(
          diagnostics,
          arms.unusedOneWayMargin,
          node,
          `${type} '${node.name}' has 'one_way_collision_margin' set to ${margin}, but 'one_way_collision' is ${rawProps.one_way_collision || 'not set (defaults to false)'}. The margin will have no effect unless 'one_way_collision' is true.`
        );
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
