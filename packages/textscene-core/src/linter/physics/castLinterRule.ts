/**
 * The rule for `RayCast2D`, `RayCast3D`, `ShapeCast2D` and `ShapeCast3D`. All four
 * take the same three properties into the same space-state query, so they share two
 * dead-configuration checks. The shape casts add the missing-shape warning from their
 * own `get_configuration_warnings` override, which the ray casts lack.
 */

import { ruleInt } from '../validators/commonValidators.js';
import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { armEmits, reportArm, type RuleArm, type RuleArms } from '../ruleArms.js';
import type { PhysicsDim } from './dim.js';
import { resolveResourceSlot } from '../resourceChecker.js';
import { dimSuffix } from './dim.js';
import { boolSlotValue, descendsFromClass } from '../../godot/index.js';

/** Which of the two cast families, which differ only by the `shape` property. */
export type CastKind = 'Ray' | 'Shape';

export function makeCastLinterRule(dim: PhysicsDim, kind: CastKind): LintRule {
  const type = `${kind}Cast${dim}`;
  const prefix = `${kind.toLowerCase()}cast${dimSuffix(dim)}`;
  const shapeType = `Shape${dim}`;

  // `_can_collide_with` filters every query result, one copy per dimension for both
  // kinds. The cite names its body clause, `get_type() == TYPE_BODY && !p_collide_with_bodies`.
  // Its area twin sits four lines above, and 3D's TYPE_SOFT_BODY clause below gates
  // on the same `collide_with_bodies` flag, so the two dimensions decide alike.
  const canCollideCite = dim === '2D' ? 'godot_space_2d.cpp:52' : 'godot_space_3d.cpp:52';
  // Its first clause, the mask test against each candidate's collision_layer.
  const maskCite = dim === '2D' ? 'godot_space_2d.cpp:44' : 'godot_space_3d.cpp:44';

  // Each arm's enabling condition, stated once (see `ruleArms.ts`). ShapeCast3D
  // sweeps its shape through the solver, which cannot handle a concave mesh
  // (`shape_cast_3d.cpp:188` warns on it); the 2D solver has no such limit.
  const hasShape = kind === 'Shape';
  const configWarning = { kind: 'configuration-warning' } as const;
  const arms: RuleArms<'noCollideTarget' | 'zeroMask' | 'missingShape' | 'concaveShape'> = {
    noCollideTarget: {
      severity: 'info',
      ruleName: `${prefix}-no-collide-target`,
      grounding: {
        kind: 'engine-inert',
        at: canCollideCite,
        unused: 'both type clauses reject their category, so the query matches nothing',
      },
    },
    zeroMask: {
      severity: 'info',
      ruleName: `${prefix}-zero-mask`,
      grounding: {
        kind: 'engine-inert',
        at: maskCite,
        unused: 'the layer test fails for every object, so the cast reports no hit',
      },
    },
    missingShape: hasShape
      ? {
          severity: 'warning',
          ruleName: `${prefix}-missing-shape`,
          grounding: configWarning,
        }
      : undefined,
    concaveShape:
      hasShape && dim === '3D'
        ? {
            severity: 'warning',
            ruleName: `${prefix}-concave-shape`,
            grounding: configWarning,
          }
        : undefined,
  };

  function check(context: RuleContext): Diagnostic[] {
    const { node } = context;

    const props = node.properties as Record<string, string>;
    const diagnostics: Diagnostic[] = [];
    const report = (arm: RuleArm | undefined, message: string) =>
      reportArm(diagnostics, arm, node, message);

    // Defaults per doc/classes/{Ray,Shape}Cast{2D,3D}.xml, the same for all four:
    // collide_with_areas false, collide_with_bodies true. The default also stands
    // for an unreadable value: a spelling `can_convert_strict` refuses never reaches
    // the slot, so the flag keeps the class default and phase 1 reports the text.
    const withAreas = boolSlotValue(props.collide_with_areas) ?? false;
    const withBodies = boolSlotValue(props.collide_with_bodies) ?? true;
    if (!withAreas && !withBodies) {
      report(arms.noCollideTarget, `${type} '${node.name}' has both 'collide_with_areas' and 'collide_with_bodies' set to false. It can never report a collision with anything.`);
    }

    // `ruleInt` reads the value Godot stores; `parseInt` stops at the
    // first character it cannot use and misses an exponent-written zero. All
    // four setters take uint32_t (ray_cast_2d.h:81, shape_cast_2d.h:91,
    // ray_cast_3d.h:100, shape_cast_3d.h:106).
    const mask = ruleInt(props.collision_mask, null, 'uint32');
    if (mask === 0) {
      report(arms.zeroMask, `${type} '${node.name}' has 'collision_mask' set to 0. It is on no collision layers and will never detect anything.`);
    }

    if (arms.missingShape) {
      // "This node cannot interact with other objects unless a Shape2D is
      // assigned.": scene/2d/physics/shape_cast_2d.cpp:407, and its 3D twin.
      const shape = resolveResourceSlot(context.scene, props.shape);
      if (shape.kind === 'empty') {
        report(arms.missingShape, `${type} '${node.name}' has no 'shape'. It cannot interact with other objects until a ${shapeType} is assigned.`);
      } else if (shape.kind === 'resolved' && descendsFromClass(shape.type, 'ConcavePolygonShape3D')) {
        // `descendsFromClass`, not an exact name: `shape_cast_3d.cpp:188` tests
        // `Object::cast_to<ConcavePolygonShape3D>(*shape)`, which a subclass passes.
        report(arms.concaveShape, `${type} '${node.name}' uses a ConcavePolygonShape3D. Godot does not support concave shapes here and reports no collisions.`);
      }
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Flags a ${type} configured so it can never report a collision`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
