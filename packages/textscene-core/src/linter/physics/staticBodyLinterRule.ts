/**
 * Dimension-parameterized semantic linter rule for StaticBody2D / StaticBody3D.
 *
 * The genuine dimension-specific seam is `constant_angular_velocity`: in 2D it is
 * a scalar (float), in 3D it is a Vector3. `constant_linear_velocity` is a
 * Vector2/Vector3 accordingly. Format validation stays in each slice's
 * linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import {
  hasCollisionShapeDescendant,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeDescendant.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import { tupleComponent } from '../validators/commonValidators.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { descendsFrom } from '../nodeBaseTypes.js';

export function makeStaticBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `StaticBody${dim}`;
  const prefix = `staticbody${dimSuffix(dim)}`;

  const vectorArity = dim === '2D' ? 2 : 3;
  const vectorRegex = makeFloatTupleRegex(dim === '2D' ? 'Vector2' : 'Vector3', vectorArity);

  /** True when any component of the vector value is non-zero. */
  function isNonZeroVector(value: string): boolean {
    const match = vectorRegex.exec(value);
    if (!match) {
      return false;
    }
    for (let i = 1; i <= vectorArity; i++) {
      if (tupleComponent(match[i]) !== 0) {
        return true;
      }
    }
    return false;
  }

  function pushConstantVelocityWarning(diagnostics: Diagnostic[], node: RuleContext['node'], kind: 'linear' | 'rotate', raw: string): void {
    const verb = kind === 'linear' ? 'move' : 'rotate';
    const propName = kind === 'linear' ? 'constant_linear_velocity' : 'constant_angular_velocity';
    diagnostics.push({
      severity: 'warning',
      message: `${type} '${node.name}' has non-zero ${propName} (${raw}). This affects touching bodies but doesn't ${verb} the static body itself, which can be confusing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: `${prefix}-constant-velocity-warning`,
    });
  }

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;


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

    // Warning: StaticBody without collision shape is useless
    if (!hasCollisionShapeDescendant(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Static bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Warning: Non-zero constant_linear_velocity on static body (unusual/confusing)
    if (rawProps.constant_linear_velocity && isNonZeroVector(rawProps.constant_linear_velocity)) {
      pushConstantVelocityWarning(diagnostics, node, 'linear', rawProps.constant_linear_velocity);
    }

    // Warning: Non-zero constant_angular_velocity on static body (unusual/confusing).
    // Dimension seam: 2D angular velocity is a scalar float; 3D is a Vector3.
    if (dim === '2D') {
      if (rawProps.constant_angular_velocity) {
        const angularVel = parseFloat(rawProps.constant_angular_velocity);
        if (!isNaN(angularVel) && angularVel !== 0) {
          pushConstantVelocityWarning(diagnostics, node, 'rotate', rawProps.constant_angular_velocity);
        }
      }
    } else {
      if (rawProps.constant_angular_velocity && isNonZeroVector(rawProps.constant_angular_velocity)) {
        pushConstantVelocityWarning(diagnostics, node, 'rotate', rawProps.constant_angular_velocity);
      }
    }

    pushZeroCollisionLayerMaskWarnings(diagnostics, node, rawProps, type, prefix);

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} resource references, collision shapes, and physics configuration`,
      category: 'validation',
      applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, type),
      emits: [
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-constant-velocity-warning`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-layer`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-mask`, severity: 'warning' },
      ],
    },
    check,
  };
}
