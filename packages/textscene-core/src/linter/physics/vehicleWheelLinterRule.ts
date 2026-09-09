/**
 * Dimension-parameterized semantic linter rule for VehicleWheel3D.
 *
 * Godot has no 2D vehicle wheel, so `dim` is always '3D' today; the factory
 * shape matches the sibling physics rules and is what ruleCoverage derives the
 * rule name from.
 *
 * Format validation lives in the slice's linterParser.ts. This rule covers the
 * one thing only full scene context can decide: whether the wheel is where
 * Godot needs it. It is a WARNING, since a detached wheel still parses and
 * renders.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { parentTypeVerdict } from '../parentType.js';

export function makeVehicleWheelLinterRule(dim: PhysicsDim): LintRule {
  const type = `VehicleWheel${dim}`;
  const bodyType = `VehicleBody${dim}`;
  const prefix = `vehiclewheel${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    // Godot: "VehicleWheel3D serves to provide a wheel system to a VehicleBody3D.
    // Please use it as a child of a VehicleBody3D." It is a DIRECT-child
    // requirement — a wheel under an intermediate Node3D is not picked up.
    //
    // An instanced sub-scene's root carries `instance=` instead of `type=`, so
    // its real class lives in a file this linter never opens: whether it is a
    // vehicle body is unanswerable, and guessing "no" flags a wheel added as an
    // editable child of an instanced vehicle. Same caution as
    // nodes/2d/parallaxlayer/linter.ts and physics/joints/shared/linter.ts.
    //
    // `root` stays a warning while `unknowable` does not: this rule WARNS at
    // the scene root, and collapsing the two arms would silence it there.
    // `cast_to<VehicleBody3D>` (vehicle_body_3d.cpp:147) accepts subclasses,
    // which is the comparison `parentTypeVerdict` makes.
    const placement = parentTypeVerdict(scene, node, bodyType);
    if (placement.kind === 'root' || placement.kind === 'mismatch') {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' is not a direct child of a ${bodyType}. Godot only attaches wheels that are direct children of the vehicle body; this wheel will do nothing.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-not-under-vehicle-body`,
      });
    }

    // No damping_relaxation vs damping_compression check: both are
    // PROPERTY_HINT_NONE with plain setters, and the "relaxation should be
    // slightly higher" relationship exists only in class-reference prose.

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} placement under a ${bodyType}`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        {
          ruleName: `${prefix}-not-under-vehicle-body`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
      ],
    },
    check,
  };
}
