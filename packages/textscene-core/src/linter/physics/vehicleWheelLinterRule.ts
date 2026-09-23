/**
 * The VehicleWheel3D placement warning; a detached wheel still parses and renders.
 * Godot has no 2D vehicle wheel, but the factory shape matches the sibling physics
 * rules, and ruleCoverage derives the rule name from it.
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

    // Godot: "Please use it as a child of a VehicleBody3D", and only a direct child
    // is picked up. `cast_to<VehicleBody3D>` (vehicle_body_3d.cpp:147) accepts
    // subclasses, the comparison `parentTypeVerdict` makes.
    const placement = parentTypeVerdict(scene, node, bodyType);
    // An instanced parent's class is in a file this linter never opens, so
    // `unknowable` stays silent, as in nodes/2d/parallaxlayer/linter.ts and
    // physics/joints/shared/linter.ts. `root` still warns.
    if (placement.kind === 'root' || placement.kind === 'mismatch') {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' is not a direct child of a ${bodyType}. Godot only attaches wheels that are direct children of the vehicle body; this wheel will do nothing.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-not-under-vehicle-body`,
      });
    }

    // No check between damping_relaxation and damping_compression: both are
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
