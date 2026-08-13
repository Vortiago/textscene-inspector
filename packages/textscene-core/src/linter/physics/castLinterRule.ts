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

import { parseGodotInt } from '../validators/commonValidators.js';
import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { checkResourceExists, heldResource, referencedResourceType } from '../resourceChecker.js';
import { dimSuffix } from './dim.js';

/** Which of the two cast families — they differ only by the `shape` property. */
export type CastKind = 'Ray' | 'Shape';

export function makeCastLinterRule(dim: PhysicsDim, kind: CastKind): LintRule {
  const type = `${kind}Cast${dim}`;
  const prefix = `${kind.toLowerCase()}cast${dimSuffix(dim)}`;
  const shapeType = `Shape${dim}`;

  // ShapeCast3D sweeps a shape through the solver, which cannot handle a
  // concave mesh — scene/3d/physics/shape_cast_3d.cpp:188 warns on it. The 2D
  // solver has no equivalent restriction.
  const rejectsConcave = kind === 'Shape' && dim === '3D';

  // `_can_collide_with` filters every space-state query result. Keyed on `dim`
  // alone, not on `kind`: one function serves the ray and the shape query in a
  // dimension, and the two dimensions have their own copy of it.
  // The BODY clause specifically — `get_type() == TYPE_BODY && !p_collide_with_bodies`
  // — since a cite names a construct, not a function signature. Its area twin sits
  // four lines above it, and 3D adds a TYPE_SOFT_BODY clause below that gates on the
  // same `collide_with_bodies` flag, so the two dimensions still decide alike.
  const canCollideCite = dim === '2D' ? 'godot_space_2d.cpp:52' : 'godot_space_3d.cpp:52';
  // Its first clause, the mask test against each candidate's collision_layer.
  const maskCite = dim === '2D' ? 'godot_space_2d.cpp:44' : 'godot_space_3d.cpp:44';

  function check(context: RuleContext): Diagnostic[] {
    const { node } = context;

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

    // `parseGodotInt` reads the value Godot stores; `parseInt` stops at the
    // first character it cannot use and misses an exponent-written zero.
    const mask = parseGodotInt(props.collision_mask ?? '');
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
      const shape = heldResource(props.shape);
      if (shape === undefined) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has no 'shape'. It cannot interact with other objects until a ${shapeType} is assigned.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-missing-shape`,
        });
      } else if (!checkResourceExists(context.scene, shape)) {
        // An error, not advice, and the same severity `CollisionShape2D/3D`
        // already gives a dangling `shape` — the two nodes take the identical
        // property and a broken reference is equally fatal on either.
        diagnostics.push({
          severity: 'error',
          message: `${type} '${node.name}' references ${props.shape} for 'shape', which this scene does not define.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-unresolved-shape`,
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
      description: `Flags a ${type} configured so it can never report a collision`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        {
          ruleName: `${prefix}-no-collide-target`,
          severity: 'warning',
          grounding: {
            kind: 'engine-inert',
            at: canCollideCite,
            unused: 'both type clauses reject their category, so the query matches nothing',
          },
        },
        {
          ruleName: `${prefix}-zero-mask`,
          severity: 'warning',
          grounding: {
            kind: 'engine-inert',
            at: maskCite,
            unused: 'the layer test fails for every object, so the cast reports no hit',
          },
        },
        ...(kind === 'Shape'
          ? [
              {
                ruleName: `${prefix}-missing-shape`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
              {
                ruleName: `${prefix}-unresolved-shape`,
                severity: 'error' as const,
                grounding: {
                  kind: 'no-engine-counterpart',
                  scope: 'dangling-reference',
                  because: 'the shape id is not declared anywhere in this file',
                } as const,
              },
            ]
          : []),
        ...(rejectsConcave
          ? [
              {
                ruleName: `${prefix}-concave-shape`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
            ]
          : []),
      ],
    },
    check,
  };
}
