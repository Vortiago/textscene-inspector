/**
 * Dimension-parameterized semantic linter rule for StaticBody2D / StaticBody3D.
 *
 * The two slices are identical after a 2D↔3D token swap, so a single factory
 * builds both. Format validation stays in each slice's linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { descendsFrom } from '../nodeBaseTypes.js';

export function makeStaticBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `StaticBody${dim}`;
  const prefix = `staticbody${dimSuffix(dim)}`;

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
    if (!hasCollisionShapeChild(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message: `${node.type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Static bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Neither constant velocity gets a check: both setters are plain
    // assignments forwarding to `body_set_state`, and neither property carries
    // a hint, so a non-zero value is an ordinary configuration.

    // Neither `collision_layer == 0` nor `collision_mask == 0` gets a check.
    // Godot has no such warning for ANY type — grepping `scene/` and `modules/`
    // for a zero comparison on either property returns nothing — and both are
    // ordinary shipped configurations: a static body that only needs to BE
    // detected carries `collision_mask = 0`, and a projectile that only needs
    // to detect carries `collision_layer = 0`.

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} resource references, collision shapes, and physics configuration`,
      category: 'validation',
      applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, type),
      emits: [
        {
          ruleName: `valid-${prefix}-resources`,
          severity: 'error',
          grounding: {
            kind: 'no-engine-counterpart',
            scope: 'dangling-reference',
            because: 'the physics_material_override id is not declared anywhere in this file',
          },
        },
        {
          ruleName: `${prefix}-needs-collision-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
      ],
    },
    check,
  };
}
