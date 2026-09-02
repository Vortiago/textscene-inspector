/**
 * Dimension-parameterized semantic linter rule for StaticBody2D / StaticBody3D.
 *
 * The two slices are identical after a 2D↔3D token swap, so a single factory
 * builds both. Format validation stays in each slice's linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';

export function makeStaticBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `StaticBody${dim}`;
  const prefix = `staticbody${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;

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
          ruleName: `${prefix}-needs-collision-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
      ],
    },
    check,
  };
}
