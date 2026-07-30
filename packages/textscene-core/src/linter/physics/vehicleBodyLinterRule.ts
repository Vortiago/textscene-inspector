/**
 * Dimension-parameterized semantic linter rule for VehicleBody3D.
 *
 * Godot has no 2D vehicle body, so `dim` is always '3D' today; the factory shape
 * is kept because ruleCoverage derives the rule name from it, and because the
 * sibling body rules (rigidBody/staticBody/characterBody) are all built this way.
 *
 * Format validation lives in the slice's linterParser.ts; this rule handles the
 * checks that need full scene context — the resource reference, and the two
 * structural facts that make a VehicleBody3D a vehicle rather than a rigid body:
 * it needs wheels, and it needs a collision shape.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import { hasDescendantOfType } from './hasDescendantOfType.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

const TRANSFORM3D_REGEX = makeFloatTupleRegex('Transform3D', 12);

/** Godot's own tolerance in RigidBody3D::get_configuration_warnings(). */
const SCALE_EPSILON = 0.05;

/**
 * Basis column lengths of a `Transform3D(...)` literal, or null if unparsable.
 * The first nine numbers are the basis ROWS (utils/transform.ts documents the
 * convention); column length is the scale along each axis.
 */
function basisScale(raw: string): [number, number, number] | null {
  const match = TRANSFORM3D_REGEX.exec(raw);
  if (!match) return null;
  const n = match.slice(1, 10).map((v) => parseFloat(v ?? ''));
  if (n.some((v) => Number.isNaN(v))) return null;
  const col = (i: number): number => Math.hypot(n[i]!, n[i + 3]!, n[i + 6]!);
  return [col(0), col(1), col(2)];
}

export function makeVehicleBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `VehicleBody${dim}`;
  const shapeType = `CollisionShape${dim}`;
  const wheelType = `VehicleWheel${dim}`;
  const prefix = `vehiclebody${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    const rawProps = node.properties as unknown as Record<string, string>;

    if (rawProps.physics_material_override) {
      if (!checkResourceExists(scene, rawProps.physics_material_override)) {
        diagnostics.push({
          severity: 'error',
          message: `Physics material resource not found: ${rawProps.physics_material_override}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `valid-${prefix}-resources`,
        });
      }
    }

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

    if (!hasDescendantOfType(node, shapeType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${shapeType} children. Vehicle bodies need collision shapes for their chassis to collide with the world.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Godot warns on this for every RigidBody3D, and VehicleBody3D inherits it:
    // "Scale changes to RigidBody3D will be overridden by the physics engine when
    // running. Please change the size in children collision shapes instead."
    if (rawProps.transform !== undefined) {
      const scale = basisScale(rawProps.transform);
      if (scale !== null && scale.some((s) => Math.abs(s - 1) > SCALE_EPSILON)) {
        const shown = scale.map((s) => Number(s.toFixed(3))).join(', ');
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has a scaled transform (${shown}). The physics engine overrides scale on a body at runtime; size the child ${shapeType} instead.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-scaled-transform`,
        });
      }
    }

    pushZeroCollisionLayerMaskWarnings(diagnostics, node, rawProps, type, prefix);

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} resource references, wheels, collision shapes, and collision layers`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-needs-wheels`, severity: 'warning' },
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-scaled-transform`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-layer`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-mask`, severity: 'warning' },
      ],
    },
    check,
  };
}
