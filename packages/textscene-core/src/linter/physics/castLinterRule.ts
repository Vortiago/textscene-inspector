/**
 * Dimension- and kind-parameterized semantic rule for the four physics casts:
 * `RayCast2D`, `RayCast3D`, `ShapeCast2D`, `ShapeCast3D`.
 *
 * All four take the same three properties into the same space-state query, so
 * the two dead-configuration checks below are one piece of knowledge, not four.
 * The same reasoning already backs `areaLinterRule.ts`, whose Area2D/Area3D pair
 * is built from a single factory.
 *
 * The shape casts additionally carry a check Godot itself makes — one of the
 * few nodes with a `get_configuration_warnings` override, so the engine names
 * the defect rather than us inferring it. The ray casts have no such override,
 * which is exactly why they get the shared two and nothing more.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

/** Which of the two cast families — they differ only by the `shape` property. */
export type CastKind = 'Ray' | 'Shape';

/**
 * `SubResource("BoxShape3D_ab12")` / `ExtResource("1_xy")` → the resource's
 * declared type, or undefined when the reference names nothing in the scene.
 */
function referencedResourceType(
  scene: RuleContext['scene'],
  value: string | undefined
): string | undefined {
  const match = value?.match(/^(SubResource|ExtResource)\("([^"]+)"\)$/);
  if (!match) return undefined;
  const pool = match[1] === 'SubResource' ? scene.internalResources : scene.externalResources;
  return pool.find((r) => r.id === match[2])?.type;
}

export function makeCastLinterRule(dim: PhysicsDim, kind: CastKind): LintRule {
  const type = `${kind}Cast${dim}`;
  const prefix = `${kind.toLowerCase()}cast${dimSuffix(dim)}`;
  const shapeType = `Shape${dim}`;

  // ShapeCast3D sweeps a shape through the solver, which cannot handle a
  // concave mesh — scene/3d/physics/shape_cast_3d.cpp:188 warns on it. The 2D
  // solver has no equivalent restriction.
  const rejectsConcave = kind === 'Shape' && dim === '3D';

  function check(context: RuleContext): Diagnostic[] {
    const { node } = context;
    if (node.type !== type) return [];

    const props = node.properties as Record<string, string>;
    const diagnostics: Diagnostic[] = [];

    // Defaults per doc/classes/{Ray,Shape}Cast{2D,3D}.xml — identical across all
    // four: collide_with_areas false, collide_with_bodies true.
    const withAreas = (props.collide_with_areas ?? 'false') === 'true';
    const withBodies = (props.collide_with_bodies ?? 'true') === 'true';
    if (!withAreas && !withBodies) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has both 'collide_with_areas' and 'collide_with_bodies' set to false. It can never report a collision with anything.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-no-collide-target`,
      });
    }

    const mask = Number.parseInt(props.collision_mask ?? '', 10);
    if (mask === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has 'collision_mask' set to 0. It is on no collision layers and will never detect anything.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-zero-mask`,
      });
    }

    if (kind === 'Shape') {
      // "This node cannot interact with other objects unless a Shape2D is
      // assigned." — scene/2d/physics/shape_cast_2d.cpp:407, and its 3D twin.
      if (props.shape === undefined) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has no 'shape'. It cannot interact with other objects until a ${shapeType} is assigned.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-missing-shape`,
        });
      } else if (
        rejectsConcave &&
        referencedResourceType(context.scene, props.shape) === 'ConcavePolygonShape3D'
      ) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' uses a ConcavePolygonShape3D. Godot does not support concave shapes here and reports no collisions.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-concave-shape`,
        });
      }
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Warns when a ${type} is configured so it can never report a collision`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `${prefix}-no-collide-target`, severity: 'warning' as const },
        { ruleName: `${prefix}-zero-mask`, severity: 'warning' as const },
        ...(kind === 'Shape'
          ? [{ ruleName: `${prefix}-missing-shape`, severity: 'warning' as const }]
          : []),
        ...(rejectsConcave
          ? [{ ruleName: `${prefix}-concave-shape`, severity: 'warning' as const }]
          : []),
      ],
    },
    check,
  };
}
