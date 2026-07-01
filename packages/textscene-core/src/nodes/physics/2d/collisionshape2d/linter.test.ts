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

    describe('shape property validation', () => {
      it('should accept valid SubResource reference', () => {
        expectClean(
          scene(
            sub('CircleShape2D', 'circle_shape'),
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("circle_shape")' }, { name: 'Collision', parent: '.' })
          )
        );
      });

      it('should accept valid ExtResource reference', () => {
        expectClean(
          scene(
            '[ext_resource type="Shape2D" path="res://shapes/rectangle.tres" id="ext_shape"]',
            staticBody,
            node('CollisionShape2D', { shape: 'ExtResource("ext_shape")' }, { name: 'Collision', parent: '.' })
          )
        );
      });

      it('should reject invalid shape reference format', () => {
        const content = scene(
          staticBody,
          node('CollisionShape2D', { shape: '"invalid_format"' }, { name: 'InvalidShape', parent: '.' })
        );
        const shapeError = expectDiagnostic(content, { prop: 'shape', contains: ['resource reference'] });
        expect(shapeError.ruleName).toBe('strict-parser');
      });

      it('should reject shape with invalid characters', () => {
        const diagnostics = lint(
          scene(
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource(rect shape)' }, { name: 'BadShape', parent: '.' })
          )
        );
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shape');
      });
    });

    describe('disabled property validation', () => {
      it('should accept disabled = true', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', disabled: true }, { name: 'DisabledCollision', parent: '.' })
          )
        );
      });

      it('should accept disabled = false', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', disabled: false }, { name: 'EnabledCollision', parent: '.' })
          )
        );
      });

      it('should reject non-boolean disabled value', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', disabled: 1 }, { name: 'InvalidDisabled', parent: '.' })
        );
        const disabledError = expectDiagnostic(content, { prop: 'disabled', contains: ['boolean'] });
        expect(disabledError.ruleName).toBe('strict-parser');
      });

      it('should reject string non-boolean disabled value', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', disabled: '"yes"' }, { name: 'InvalidDisabled', parent: '.' })
        );
        expectDiagnostic(content, { prop: 'disabled', contains: ['boolean'] });
      });
    });

    describe('one_way_collision property validation', () => {
      it('should accept one_way_collision = true', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true }, { name: 'OneWayCollision', parent: '.' })
          )
        );
      });

      it('should accept one_way_collision = false', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: false }, { name: 'TwoWayCollision', parent: '.' })
          )
        );
      });

      it('should reject non-boolean one_way_collision value', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: 1 }, { name: 'InvalidOneWay', parent: '.' })
        );
        const oneWayError = expectDiagnostic(content, { prop: 'one_way_collision', contains: ['boolean'] });
        expect(oneWayError.ruleName).toBe('strict-parser');
      });
    });

    describe('one_way_collision_margin property validation', () => {
      it('should accept valid non-negative margin', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true, one_way_collision_margin: 1.5 }, { name: 'OneWayWithMargin', parent: '.' })
          )
        );
      });

      it('should accept zero margin', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true, one_way_collision_margin: 0.0 }, { name: 'ZeroMargin', parent: '.' })
          )
        );
      });

      it('should reject negative margin', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true, one_way_collision_margin: -1.0 }, { name: 'NegativeMargin', parent: '.' })
        );
        const marginError = expectDiagnostic(content, { prop: 'one_way_collision_margin', contains: ['non-negative'] });
        expect(marginError.ruleName).toBe('strict-parser');
      });

      it('should reject non-numeric margin', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', one_way_collision: true, one_way_collision_margin: '"invalid"' }, { name: 'InvalidMargin', parent: '.' })
        );
        expectDiagnostic(content, { prop: 'one_way_collision_margin', contains: ['number'] });
      });
    });

    describe('debug_color property validation', () => {
      it('should accept Color with RGB values', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', debug_color: 'Color(1, 0, 0)' }, { name: 'ColoredCollision', parent: '.' })
          )
        );
      });

      it('should accept Color with RGBA values', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', debug_color: 'Color(0, 0.6, 0.7, 0.42)' }, { name: 'TransparentCollision', parent: '.' })
          )
        );
      });

      it('should accept Color with spaces', () => {
        expectClean(
          scene(
            rectShape,
            staticBody,
            node('CollisionShape2D', { shape: 'SubResource("shape_1")', debug_color: 'Color( 0.5 , 0.5 , 0.5 , 1.0 )' }, { name: 'SpacedColor', parent: '.' })
          )
        );
      });

      it('should reject invalid color format', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', debug_color: '"red"' }, { name: 'InvalidColor', parent: '.' })
        );
        const colorError = expectDiagnostic(content, { prop: 'debug_color', contains: ['Color'] });
        expect(colorError.ruleName).toBe('strict-parser');
      });

      it('should reject color with too few components', () => {
        const content = scene(
          rectShape,
          staticBody,
          node('CollisionShape2D', { shape: 'SubResource("shape_1")', debug_color: 'Color(1, 0)' }, { name: 'TwoComponents', parent: '.' })
        );
        expectDiagnostic(content, { prop: 'debug_color' });
      });
    });
  });

  describe('Semantic Validation (Required Properties)', () => {
    it('should detect missing shape property (REQUIRED)', () => {
      const content = scene(
        staticBody,
        node('CollisionShape2D', { disabled: false }, { name: 'NoShape', parent: '.' })
      );
      const shapeError = expectDiagnostic(content, {
        ruleName: 'collisionshape2d-requires-shape',
        severity: 'error',
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
        contains: ['Node2D', 'should be a child of'],
      });
      expect(parentError.nodeName).toBe('Collision');
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
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="rectangle"]
[sub_resource type="CircleShape2D" id="circle"]
[sub_resource type="CapsuleShape2D" id="capsule"]
[sub_resource type="SegmentShape2D" id="segment"]
[sub_resource type="ConvexPolygonShape2D" id="convex"]
[sub_resource type="ConcavePolygonShape2D" id="concave"]

[node name="StaticBody" type="StaticBody2D"]

[node name="RectCollision" type="CollisionShape2D" parent="."]
shape = SubResource("rectangle")

[node name="CircleCollision" type="CollisionShape2D" parent="."]
shape = SubResource("circle")

[node name="CapsuleCollision" type="CollisionShape2D" parent="."]
shape = SubResource("capsule")

[node name="SegmentCollision" type="CollisionShape2D" parent="."]
shape = SubResource("segment")

[node name="ConvexCollision" type="CollisionShape2D" parent="."]
shape = SubResource("convex")

[node name="ConcaveCollision" type="CollisionShape2D" parent="."]
shape = SubResource("concave")
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
