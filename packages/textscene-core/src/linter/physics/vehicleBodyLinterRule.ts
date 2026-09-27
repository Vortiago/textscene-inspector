/**
 * The VehicleBody3D rule: only what a VehicleBody3D adds to a RigidBody3D. Godot has
 * no 2D vehicle body, but ruleCoverage derives the rule name from the factory shape.
 * Repeating a shared check, such as the scale warning of rigid_body_3d.cpp:667, would
 * report one condition under two rule names.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { hasChildOfType } from '../childType.js';

/**
 * `_update_friction` returns before any suspension or traction impulse is
 * computed when `wheels` is empty. Not dimension-keyed: Godot declares no
 * VehicleBody2D, so this factory serves one family.
 */
const NO_WHEELS_AT = 'vehicle_body_3d.cpp:731';

/**
 * `rigidBodyLinterRule` reaches this type through `descendsFrom` with the shared body
 * set and the per-axis scale warning, so no `vehiclebody3d-scaled-transform` repeats
 * rigid_body_3d.cpp:667 here. `collisionObjectLinterRule` supplies the no-shape warning.
 */
export function makeVehicleBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `VehicleBody${dim}`;
  const wheelType = `VehicleWheel${dim}`;
  const prefix = `vehiclebody${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;

    // With no wheels, engine_force and steering do nothing and the body acts as a
    // plain RigidBody3D. VehicleWheel3D registers in NOTIFICATION_ENTER_TREE through
    // `cast_to<VehicleBody3D>(get_parent())`, so a nested wheel is never attached.
    if (!hasChildOfType(node, [wheelType])) {
      diagnostics.push({
        severity: 'info',
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
      emits: [
        {
          ruleName: `${prefix}-needs-wheels`,
          severity: 'info',
          grounding: {
            kind: 'engine-inert',
            at: NO_WHEELS_AT,
            unused: 'with no wheels the suspension and traction pass returns before applying anything',
          },
        },
      ],
    },
    check,
  };
}
