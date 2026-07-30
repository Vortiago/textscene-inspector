/**
 * Dimension-parameterized semantic linter rule for RigidBody2D / RigidBody3D.
 *
 * The two slices were identical apart from the 2D↔3D token, so a single factory
 * builds both. Format validation (mass > 0, enum values, vector format, etc.)
 * stays in each slice's linterParser.ts; this rule handles the semantic checks
 * that need full scene context (resource references, collision-shape children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import { hasDescendantOfType } from './hasDescendantOfType.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

/** Minimum recommended mass value (below this causes instability) */
const MIN_RECOMMENDED_MASS = 0.01;

/** Maximum recommended mass value (above this can cause instability) */
const MAX_RECOMMENDED_MASS = 10000;

/** Maximum recommended damping value (above this causes objects to stop too quickly) */
const MAX_RECOMMENDED_DAMPING = 10;

export function makeRigidBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `RigidBody${dim}`;
  const shapeType = `CollisionShape${dim}`;
  const prefix = `rigidbody${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Check if physics_material_override resource exists (if specified)
    if (rawProps.physics_material_override) {
      const resourceExists = checkResourceExists(scene, rawProps.physics_material_override);
      if (!resourceExists) {
        diagnostics.push({
          severity: 'error',
          message: `Physics material resource not found: ${rawProps.physics_material_override}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `valid-${prefix}-resources`,
        });
      }
    }

    // Warning: RigidBody without collision shape is useless
    if (!hasDescendantOfType(node, shapeType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${shapeType} children. Rigid bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Warning: Extreme mass values can cause instability
    if (rawProps.mass !== undefined) {
      const mass = parseFloat(rawProps.mass);
      if (!isNaN(mass)) {
        if (mass < MIN_RECOMMENDED_MASS) {
          diagnostics.push({
            severity: 'warning',
            message: `${type} '${node.name}' has very low mass (${mass}). Values below ${MIN_RECOMMENDED_MASS} can cause physics instability.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-mass-too-low`,
          });
        }
        if (mass > MAX_RECOMMENDED_MASS) {
          diagnostics.push({
            severity: 'warning',
            message: `${type} '${node.name}' has very high mass (${mass}). Values above ${MAX_RECOMMENDED_MASS} can cause physics instability.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-mass-too-high`,
          });
        }
      }
    }

    // Warning: Excessive linear damping
    if (rawProps.linear_damp !== undefined) {
      const linearDamp = parseFloat(rawProps.linear_damp);
      if (!isNaN(linearDamp) && linearDamp > MAX_RECOMMENDED_DAMPING) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has high linear_damp (${linearDamp}). Values above ${MAX_RECOMMENDED_DAMPING} cause objects to stop too quickly.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-excessive-linear-damp`,
        });
      }
    }

    // Warning: Excessive angular damping
    if (rawProps.angular_damp !== undefined) {
      const angularDamp = parseFloat(rawProps.angular_damp);
      if (!isNaN(angularDamp) && angularDamp > MAX_RECOMMENDED_DAMPING) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has high angular_damp (${angularDamp}). Values above ${MAX_RECOMMENDED_DAMPING} cause objects to stop rotating too quickly.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-excessive-angular-damp`,
        });
      }
    }

    // Warning: max_contacts_reported set but contact_monitor=false
    if (rawProps.max_contacts_reported !== undefined) {
      const contactMonitor = rawProps.contact_monitor;
      if (contactMonitor !== 'true') {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has max_contacts_reported set but contact_monitor is not enabled. The property won't work unless contact_monitor=true.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-max-contacts-without-monitor`,
        });
      }
    }

    pushZeroCollisionLayerMaskWarnings(diagnostics, node, rawProps, type, prefix);

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} resource references, collision shapes, mass values, and physics configuration`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-mass-too-low`, severity: 'warning' },
        { ruleName: `${prefix}-mass-too-high`, severity: 'warning' },
        { ruleName: `${prefix}-excessive-linear-damp`, severity: 'warning' },
        { ruleName: `${prefix}-excessive-angular-damp`, severity: 'warning' },
        { ruleName: `${prefix}-max-contacts-without-monitor`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-layer`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-mask`, severity: 'warning' },
      ],
    },
    check,
  };
}
