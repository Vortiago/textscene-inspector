/**
 * Tests for CollisionShape2D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
  instanced,
  override,
  packedScene,
  subResource,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A `[sub_resource ...]` heading block (the kit's `node`/`scene` can't express resource headings). */
const sub = (type: string, id: string): string => `[sub_resource type="${type}" id="${id}"]`;
/** The most common fixture shape + parent body reused across accept cases. */
const rectShape = sub('RectangleShape2D', 'shape_1');
const staticBody = node('StaticBody2D', {}, { name: 'StaticBody' });

describe('CollisionShape2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CollisionShape2D properties', () => {
      expectClean(
        scene(
          rectShape,
          staticBody,
          node(
            'CollisionShape2D',
            {
              shape: 'SubResource("shape_1")',
              disabled: false,
              one_way_collision: true,
              one_way_collision_margin: 1.0,
              debug_color: 'Color(0, 0.6, 0.7, 0.42)',
            },
            { name: 'CollisionShape', parent: '.' }
          )
        )
      );
    });

    it('should accept a SubResource shape of another type', () => {
      expectClean(
        scene(
          sub('CircleShape2D', 'circle_shape'),
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("circle_shape")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    it('should accept a valid ExtResource shape reference', () => {
      expectClean(
        scene(
          '[ext_resource type="Shape2D" path="res://shapes/rectangle.tres" id="ext_shape"]',
          staticBody,
          node('CollisionShape2D', { shape: 'ExtResource("ext_shape")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    runPropertyValidation(
      {
        nodeType: 'CollisionShape2D',
        prefix: [rectShape, staticBody],
        nodeOptions: { name: 'Collision', parent: '.' },
        baseProps: { shape: 'SubResource("shape_1")' },
      },
      [
        {
          prop: 'shape',
          valid: ['SubResource("shape_1")'],
          invalid: [
            {
              value: '"invalid_format"',
              ruleName: 'strict-parser',
              contains: ['shape', 'resource reference'],
            },
            { value: 'SubResource(rect shape)', ruleName: 'strict-parser', contains: ['shape'] },
          ],
        },
        {
          prop: 'disabled',
          valid: [true, false],
          invalid: [
            { value: 1, ruleName: 'strict-parser', contains: ['disabled', 'boolean'] },
            { value: '"yes"', contains: ['disabled', 'boolean'] },
          ],
        },
        {
          prop: 'one_way_collision',
          valid: [true, false],
          invalid: [
            { value: 1, ruleName: 'strict-parser', contains: ['one_way_collision', 'boolean'] },
          ],
        },
        {
          // Margin without one_way_collision legitimately warns — accepts pair it via `with`.
          prop: 'one_way_collision_margin',
          valid: [1.5, 0.0],
          with: { one_way_collision: true },
          invalid: [
            {
              value: -1.0,
              ruleName: 'strict-parser',
              // Both ends share the derived message; a min-only override read
              // as satisfied by an over-max value.
              contains: ['one_way_collision_margin', 'between 0 and 128'],
            },
            { value: '"invalid"', contains: ['one_way_collision_margin', 'number'] },
          ],
        },
        {
          prop: 'debug_color',
          valid: [
            'Color(0, 0.6, 0.7, 0.42)',
            'Color( 0.5 , 0.5 , 0.5 , 1.0 )',
            // Every component is a plain float the setter assigns unaltered, and
            // `rtos_fix` writes all three of these forms: an overbright/negative
            // channel, the scientific notation Godot emits for small values, and
            // a non-finite channel (variant_parser.cpp:2145).
            'Color(-0.5, 0, 0, 1)',
            'Color(1e-05, 0, 0, 1)',
            'Color(inf, 0, 0, 1)',
          ],
          invalid: [
            { value: '"red"', ruleName: 'strict-parser', contains: ['debug_color', 'Color'] },
            { value: 'Color(1, 0)', contains: ['debug_color'] },
            // variant_parser.cpp:913 — `args.size() != 4` is ERR_PARSE_ERROR, so
            // the three-argument spelling GDScript allows does not load from a
            // .tscn at all. The renderer's COLOR_RE has always required four.
            { value: 'Color(1, 0, 0)', contains: ['debug_color'] },
          ],
        },
      ]
      );
  });

  describe('Semantic Validation (Required Properties)', () => {
    it('should detect missing shape property (REQUIRED)', () => {
      const content = scene(
        staticBody,
        node('CollisionShape2D', { disabled: false }, { name: 'NoShape', parent: '.' })
      );
      const shapeError = expectDiagnostic(content, {
        ruleName: 'collisionshape2d-requires-shape',
        severity: 'warning',
        nodeType: 'CollisionShape2D',
        contains: ['missing required property', 'shape'],
      });
      expect(shapeError.nodeName).toBe('NoShape');
    });

    it('should pass when shape property is present', () => {
      expectClean(
        scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'ValidShape', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect non-existent shape resource', () => {
      const content = scene(
        staticBody,
        node('CollisionShape2D', { shape: 'SubResource("nonexistent")' }, { name: 'MissingResource', parent: '.' })
      );
      const resourceError = expectDiagnostic(content, {
        ruleName: 'valid-collisionshape2d-resources',
        severity: 'error',
        nodeType: 'CollisionShape2D',
        contains: ['Shape resource not found'],
      });
      expect(resourceError.nodeName).toBe('MissingResource');
    });

    it('reports nothing missing for a shape that is not a reference at all', () => {
      // `variant_parser.cpp:1089` takes only the `Resource` / `SubResource` /
      // `ExtResource` identifiers into the resource arm, so a quoted string
      // names no id and nothing can be absent. Its format is the strict
      // parser's diagnostic, and a second "not found" beside it names a
      // resource nobody wrote — while a well-formed `SubResource("nonexistent")`
      // still errors, per the case above.
      const content = scene(
        staticBody,
        node('CollisionShape2D', { shape: '"invalid_format"' }, { name: 'BadFormat', parent: '.' })
      );
      expectNoDiagnostic(content, { ruleName: 'valid-collisionshape2d-resources' });
      expectDiagnostic(content, {
        ruleName: 'strict-parser',
        contains: ['shape', 'resource reference'],
      });
    });

    it('should pass when shape resource exists', () => {
      expectClean(
        scene(
          sub('CircleShape2D', 'circle_1'),
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("circle_1")' }, { name: 'ValidResource', parent: '.' })
        )
      );
    });

    it('should validate multiple shape resources', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="rect_shape"]
[sub_resource type="CircleShape2D" id="circle_shape"]
[sub_resource type="CapsuleShape2D" id="capsule_shape"]

[node name="StaticBody1" type="StaticBody2D"]

[node name="RectCollision" type="CollisionShape2D" parent="."]
shape = SubResource("rect_shape")

[node name="CircleCollision" type="CollisionShape2D" parent="."]
shape = SubResource("circle_shape")

[node name="CapsuleCollision" type="CollisionShape2D" parent="."]
shape = SubResource("capsule_shape")
`;
      expectClean(content);
    });
  });

  describe('Semantic Validation (Parent Types)', () => {
    it('should pass with StaticBody2D parent', () => {
      expectClean(
        scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    it('should pass with RigidBody2D parent', () => {
      expectClean(
        scene(
          sub('CircleShape2D', 'shape_1'),
          node('RigidBody2D', {}, { name: 'RigidBody' }),
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    it('should pass with CharacterBody2D parent', () => {
      expectClean(
        scene(
          sub('CapsuleShape2D', 'shape_1'),
          node('CharacterBody2D', {}, { name: 'CharacterBody' }),
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    it('should pass with Area2D parent', () => {
      expectClean(
        scene(
          rectShape,
          node('Area2D', {}, { name: 'Area' }),
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    it('should pass with AnimatableBody2D parent', () => {
      expectClean(
        scene(
          rectShape,
          node('AnimatableBody2D', {}, { name: 'AnimatableBody' }),
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
        )
      );
    });

    it('should warn when parent is invalid type (Node2D)', () => {
      const content = scene(
        rectShape,
        node('Node2D', {}, { name: 'InvalidParent' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
      );
      const parentError = expectDiagnostic(content, {
        ruleName: 'collisionshape2d-invalid-parent',
        severity: 'warning',
        nodeType: 'CollisionShape2D',
        contains: ['Node2D', 'not a CollisionObject2D'],
      });
      expect(parentError.nodeName).toBe('Collision');
    });

    it('accepts a PhysicalBone2D parent, which IS a CollisionObject2D', () => {
      // Godot's test is `cast_to<CollisionObject2D>(get_parent())`
      // (collision_shape_2d.cpp), which PhysicalBone2D passes.
      const content = scene(
        rectShape,
        node('PhysicalBone2D', {}, { name: 'Bone' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
      );
      expectNoDiagnostic(content, { ruleName: 'collisionshape2d-invalid-parent' });
    });

    it('says nothing about a parent whose type is declared in another scene', () => {
      // The 3D twin carries the same case: an `instance=` parent's `type` is
      // the ExtResource ref, an override heading's is the index fallback's "0",
      // and neither can be measured against CollisionObject2D.
      const instancedParent = scene(
        packedScene,
        subResource('RectangleShape2D', {}, 'shape_1'),
        node('Node2D', {}, { name: 'Root' }),
        instanced('Body', { parent: '.' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: 'Body' })
      );
      const overrideParent = scene(
        packedScene,
        subResource('RectangleShape2D', {}, 'shape_1'),
        node('Node2D', {}, { name: 'Root' }),
        instanced('Body', { parent: '.' }),
        override('Inner', 0, { parent: 'Body' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: 'Body/Inner' })
      );
      expectNoDiagnostic(instancedParent, { ruleName: 'collisionshape2d-invalid-parent' });
      expectNoDiagnostic(overrideParent, { ruleName: 'collisionshape2d-invalid-parent' });
    });

    it('should warn when parent is invalid type (Sprite2D)', () => {
      const content = scene(
        rectShape,
        node('Sprite2D', {}, { name: 'Sprite' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
      );
      expectDiagnostic(content, { ruleName: 'collisionshape2d-invalid-parent', contains: ['Sprite2D'] });
    });

    it('should warn when CollisionShape2D has no parent (root level)', () => {
      const content = scene(
        rectShape,
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'RootCollision' })
      );
      const noParentError = expectDiagnostic(content, {
        ruleName: 'collisionshape2d-no-parent',
        severity: 'warning',
        nodeType: 'CollisionShape2D',
        contains: ['no parent node'],
      });
      expect(noParentError.nodeName).toBe('RootCollision');
    });
  });

  describe('Semantic Validation (One-Way Collision Configuration)', () => {
    it('should warn when one_way_collision_margin is set but one_way_collision is false', () => {
      const content = scene(
        rectShape,
        staticBody,
        node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: false, one_way_collision_margin: 1.5 }, { name: 'UnusedMargin', parent: '.' })
      );
      const marginWarning = expectDiagnostic(content, {
        ruleName: 'collisionshape2d-unused-one-way-margin',
        severity: 'warning',
        nodeType: 'CollisionShape2D',
        contains: ['one_way_collision_margin', 'no effect'],
      });
      expect(marginWarning.nodeName).toBe('UnusedMargin');
    });

    it('should warn when one_way_collision_margin is set but one_way_collision is not set (defaults to false)', () => {
      const content = scene(
        rectShape,
        staticBody,
        node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision_margin: 2.0 }, { name: 'UnusedMarginDefault', parent: '.' })
      );
      expectDiagnostic(content, {
        ruleName: 'collisionshape2d-unused-one-way-margin',
        contains: ['not set (defaults to false)'],
      });
    });

    it('should not warn when one_way_collision_margin is set and one_way_collision is true', () => {
      expectClean(
        scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true, one_way_collision_margin: 1.5 }, { name: 'ValidOneWay', parent: '.' })
        )
      );
    });

    it('should not warn when one_way_collision_margin is zero (even if one_way_collision is false)', () => {
      const content = scene(
        rectShape,
        staticBody,
        node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: false, one_way_collision_margin: 0.0 }, { name: 'ZeroMarginOk', parent: '.' })
      );
      // Should only have warnings/errors unrelated to unused margin
      expectNoDiagnostic(content, { ruleName: 'collisionshape2d-unused-one-way-margin' });
    });
  });

  describe('One Way Collision ignored under Area2D (collisionshape2d-one-way-ignored-under-area2d)', () => {
    it('warns when one_way_collision is true under an Area2D parent', () => {
      const content = scene(
        rectShape,
        node('Area2D', {}, { name: 'Trigger' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true }, { name: 'Collision', parent: '.' })
      );
      const diagnostic = expectDiagnostic(content, {
        ruleName: 'collisionshape2d-one-way-ignored-under-area2d',
        severity: 'warning',
        nodeType: 'CollisionShape2D',
        contains: ['Trigger', 'ignored'],
      });
      expect(diagnostic.nodeName).toBe('Collision');
    });

    it('says nothing when one_way_collision is false under an Area2D', () => {
      expectNoDiagnostic(
        scene(
          rectShape,
          node('Area2D', {}, { name: 'Trigger' }),
          node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })
        ),
        { ruleName: 'collisionshape2d-one-way-ignored-under-area2d' }
      );
    });

    it('says nothing when one_way_collision is true under a StaticBody2D', () => {
      expectNoDiagnostic(
        scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true }, { name: 'Collision', parent: '.' })
        ),
        { ruleName: 'collisionshape2d-one-way-ignored-under-area2d' }
      );
    });
  });

  describe('polygon shape limited editing (collisionshape2d-polygon-shape-limited-editing)', () => {
    it('warns when shape resolves to a ConvexPolygonShape2D', () => {
      expectDiagnostic(
        scene(
          sub('ConvexPolygonShape2D', 'convex'),
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("convex")' }, { name: 'Collision', parent: '.' })
        ),
        {
          ruleName: 'collisionshape2d-polygon-shape-limited-editing',
          severity: 'warning',
          contains: ['ConvexPolygonShape2D', 'CollisionPolygon2D'],
        }
      );
    });

    it('warns when shape resolves to a ConcavePolygonShape2D', () => {
      expectDiagnostic(
        scene(
          sub('ConcavePolygonShape2D', 'concave'),
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("concave")' }, { name: 'Collision', parent: '.' })
        ),
        { ruleName: 'collisionshape2d-polygon-shape-limited-editing', severity: 'warning' }
      );
    });

    it('says nothing for a RectangleShape2D', () => {
      expectNoDiagnostic(
        scene(rectShape, staticBody, node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'Collision', parent: '.' })),
        { ruleName: 'collisionshape2d-polygon-shape-limited-editing' }
      );
    });
  });

  describe('Semantic Validation (Transform Scale)', () => {
    it('does not warn on a non-uniformly scaled node — collision_shape_2d.cpp has no such check', () => {
      expectNoDiagnostic(
        scene(
          rectShape,
          staticBody,
          node(
            'CollisionShape2D',
            { shape: 'SubResource("shape_1")', scale: 'Vector2(2, 1)' },
            { name: 'Collision', parent: '.' }
          )
        ),
        { ruleName: 'collisionshape2d-non-uniform-scale' }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = scene(
        node('Node2D', {}, { name: 'InvalidParent' }),
        node('CollisionShape2D', { disabled: 'not_a_boolean' }, { name: 'MultipleErrors', parent: '.' })
      );
      const diagnostics = lint(content);
      // Expect: missing shape (error), invalid parent (warning), invalid disabled format (error)
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const hasShapeError = diagnostics.some(d => d.message.includes('missing required property'));
      const hasParentWarning = diagnostics.some(d => d.message.includes('invalid-parent') || d.message.includes('should be a child'));
      const hasDisabledError = diagnostics.some(d => d.message.includes('disabled'));
      // At least one error should be present
      expect(hasShapeError || hasParentWarning || hasDisabledError).toBe(true);
    });

    it('should detect CollisionShape2D with deeply nested parent structure', () => {
      const content = scene(
        rectShape,
        node('Node2D', {}, { name: 'Root' }),
        node('StaticBody2D', {}, { name: 'StaticBody', parent: '.' }),
        node('CollisionShape2D', { shape: 'SubResource("shape_1")' }, { name: 'NestedCollision', parent: 'StaticBody' })
      );
      // This should pass - StaticBody2D is the immediate parent
      expectClean(content);
    });

    it('should handle CollisionShape2D with only shape property', () => {
      expectClean(
        scene(
          sub('SegmentShape2D', 'segment'),
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("segment")' }, { name: 'MinimalCollision', parent: '.' })
        )
      );
    });

    it('should handle all common 2D shape types', () => {
      // Convex/ConcavePolygonShape2D are exercised separately below — Godot
      // itself warns on them (collision_shape_2d.cpp:184-189), so they are not
      // an "accept clean" case any more.
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="rectangle"]
[sub_resource type="CircleShape2D" id="circle"]
[sub_resource type="CapsuleShape2D" id="capsule"]
[sub_resource type="SegmentShape2D" id="segment"]

[node name="StaticBody" type="StaticBody2D"]

[node name="RectCollision" type="CollisionShape2D" parent="."]
shape = SubResource("rectangle")

[node name="CircleCollision" type="CollisionShape2D" parent="."]
shape = SubResource("circle")

[node name="CapsuleCollision" type="CollisionShape2D" parent="."]
shape = SubResource("capsule")

[node name="SegmentCollision" type="CollisionShape2D" parent="."]
shape = SubResource("segment")
`;
      expectClean(content);
    });

    it('should handle disabled collision shape', () => {
      expectClean(
        scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', disabled: true }, { name: 'DisabledCollision', parent: '.' })
        )
      );
    });

    it('should handle node with no properties at all', () => {
      const content = scene(
        staticBody,
        node('CollisionShape2D', {}, { name: 'EmptyCollision', parent: '.' })
      );
      // Should have error for missing shape
      expectDiagnostic(content, { prop: 'missing required property' });
    });

    it('should handle one-way collision platforms', () => {
      expectClean(
        scene(
          sub('RectangleShape2D', 'platform_shape'),
          node('StaticBody2D', {}, { name: 'Platform' }),
          node('CollisionShape2D', { shape: 'SubResource("platform_shape")', one_way_collision: true, one_way_collision_margin: 1.0 }, { name: 'PlatformCollision', parent: '.' })
        )
      );
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete 2D physics scene with multiple bodies', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="ground_shape"]
[sub_resource type="CircleShape2D" id="ball_shape"]
[sub_resource type="CapsuleShape2D" id="player_shape"]
[sub_resource type="RectangleShape2D" id="trigger_shape"]

[node name="Scene" type="Node2D"]

[node name="Ground" type="StaticBody2D" parent="."]

[node name="GroundCollision" type="CollisionShape2D" parent="Ground"]
shape = SubResource("ground_shape")
one_way_collision = true
one_way_collision_margin = 1.0

[node name="Ball" type="RigidBody2D" parent="."]

[node name="BallCollision" type="CollisionShape2D" parent="Ball"]
shape = SubResource("ball_shape")

[node name="Player" type="CharacterBody2D" parent="."]

[node name="PlayerCollision" type="CollisionShape2D" parent="Player"]
shape = SubResource("player_shape")

[node name="Trigger" type="Area2D" parent="."]

[node name="TriggerCollision" type="CollisionShape2D" parent="Trigger"]
shape = SubResource("trigger_shape")
disabled = false
debug_color = Color(0, 1, 0, 0.5)
`;
      expectClean(content);
    });

    it('should validate platformer scene with one-way platforms', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="platform1"]
[sub_resource type="RectangleShape2D" id="platform2"]

[node name="Level" type="Node2D"]

[node name="Platform1" type="StaticBody2D" parent="."]

[node name="Platform1Collision" type="CollisionShape2D" parent="Platform1"]
shape = SubResource("platform1")
one_way_collision = true
one_way_collision_margin = 2.0
debug_color = Color(0.5, 0.5, 1.0, 0.6)

[node name="Platform2" type="AnimatableBody2D" parent="."]

[node name="Platform2Collision" type="CollisionShape2D" parent="Platform2"]
shape = SubResource("platform2")
one_way_collision = true
one_way_collision_margin = 1.5
`;
      expectClean(content);
    });
  });
});
