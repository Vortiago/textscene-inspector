/**
 * Dimension-parameterized semantic linter rule for VehicleBody3D.
 *
 * Godot has no 2D vehicle body, so `dim` is always '3D' today; the factory shape
 * is kept because ruleCoverage derives the rule name from it, and because the
 * sibling body rules (rigidBody/staticBody/characterBody) are all built this way.
 *
 * Format validation lives in the slice's linterParser.ts. This rule declares
 * ONLY what a VehicleBody3D adds to a RigidBody3D. `rigidBodyLinterRule` matches
 * on `descendsFrom`, so it already reaches this type and supplies the whole
 * shared body set (the physics_material_override reference, the collision-shape
 * requirement, the mass/damping bounds, the zero layer/mask advisories, and —
 * as of rigid_body_3d.cpp:667's per-axis scale check — the runtime-overridden-
 * scale warning too) exactly once; repeating any of them here would report one
 * condition under two rule names. AnimatableBody3D relies on staticBodyLinterRule
 * the same way.
 *
 * This rule used to carry its own copy of the scale check
 * (`vehiclebody3d-scaled-transform`), because `rigidBodyLinterRule` had not
 * implemented rigid_body_3d.cpp:667 yet. Now that it has (reaching VehicleBody3D
 * through the same `descendsFrom` matcher as everything else in this list), the
 * copy here retired rather than double-warning every scaled VehicleBody3D.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeVehicleBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `VehicleBody${dim}`;
  const wheelType = `VehicleWheel${dim}`;
  const prefix = `vehiclebody${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;

    // A vehicle body is driven entirely by its wheels: with none, engine_force
    // and steering do nothing at all and the body behaves as a plain RigidBody3D.
    //
    // DIRECT children only, matching the engine: VehicleWheel3D registers itself
    // in NOTIFICATION_ENTER_TREE via `cast_to<VehicleBody3D>(get_parent())`, so a
    // wheel under an intermediate node is never attached. Counting descendants
    // here would call a vehicle whose wheels are all nested "fine" when Godot
    // gives it no working wheels at all.
    if (!node.children.some((child) => child.type === wheelType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no direct ${wheelType} children. A vehicle body is driven by its wheels, and Godot only attaches wheels that are its immediate children; without them engine_force and steering have no effect.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-wheels`,
      });
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates that a ${type} has wheels`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [{ ruleName: `${prefix}-needs-wheels`, severity: 'warning' }],
    },
    check,
  };
}
