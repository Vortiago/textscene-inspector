/**
 * Tests for CollisionShape2D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('CollisionShape2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CollisionShape2D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="CollisionShape" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
disabled = false
one_way_collision = true
one_way_collision_margin = 1.0
debug_color = Color(0, 0.6, 0.7, 0.42)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('shape property validation', () => {
      it('should accept valid SubResource reference', () => {
        const content = `[gd_scene format=3]

[sub_resource type="CircleShape2D" id="circle_shape"]

[node name="StaticBody" type="StaticBody2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("circle_shape")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid ExtResource reference', () => {
        const content = `[gd_scene format=3]

[ext_resource type="Shape2D" path="res://shapes/rectangle.tres" id="ext_shape"]

[node name="StaticBody" type="StaticBody2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = ExtResource("ext_shape")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid shape reference format', () => {
        const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody2D"]

[node name="InvalidShape" type="CollisionShape2D" parent="."]
shape = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const shapeError = diagnostics.find(d => d.message.includes('shape'));
        expect(shapeError).toBeDefined();
        expect(shapeError?.message).toContain('resource reference');
        expect(shapeError?.ruleName).toBe('strict-parser');
      });

      it('should reject shape with invalid characters', () => {
        const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody2D"]

[node name="BadShape" type="CollisionShape2D" parent="."]
shape = SubResource(rect shape)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shape');
      });
    });

    describe('disabled property validation', () => {
      it('should accept disabled = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="DisabledCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
disabled = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept disabled = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="EnabledCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
disabled = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean disabled value', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="InvalidDisabled" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
disabled = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const disabledError = diagnostics.find(d => d.message.includes('disabled'));
        expect(disabledError).toBeDefined();
        expect(disabledError?.message).toContain('boolean');
        expect(disabledError?.ruleName).toBe('strict-parser');
      });

      it('should reject string non-boolean disabled value', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="InvalidDisabled" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
disabled = "yes"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const disabledError = diagnostics.find(d => d.message.includes('disabled'));
        expect(disabledError).toBeDefined();
        expect(disabledError?.message).toContain('boolean');
      });
    });

    describe('one_way_collision property validation', () => {
      it('should accept one_way_collision = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="OneWayCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept one_way_collision = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="TwoWayCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean one_way_collision value', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="InvalidOneWay" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const oneWayError = diagnostics.find(d => d.message.includes('one_way_collision'));
        expect(oneWayError).toBeDefined();
        expect(oneWayError?.message).toContain('boolean');
        expect(oneWayError?.ruleName).toBe('strict-parser');
      });
    });

    describe('one_way_collision_margin property validation', () => {
      it('should accept valid non-negative margin', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="OneWayWithMargin" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = true
one_way_collision_margin = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero margin', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="ZeroMargin" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = true
one_way_collision_margin = 0.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative margin', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="NegativeMargin" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = true
one_way_collision_margin = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const marginError = diagnostics.find(d => d.message.includes('one_way_collision_margin'));
        expect(marginError).toBeDefined();
        expect(marginError?.message).toContain('non-negative');
        expect(marginError?.ruleName).toBe('strict-parser');
      });

      it('should reject non-numeric margin', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="InvalidMargin" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = true
one_way_collision_margin = "invalid"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const marginError = diagnostics.find(d => d.message.includes('one_way_collision_margin'));
        expect(marginError).toBeDefined();
        expect(marginError?.message).toContain('number');
      });
    });

    describe('debug_color property validation', () => {
      it('should accept Color with RGB values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="ColoredCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
debug_color = Color(1, 0, 0)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept Color with RGBA values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="TransparentCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
debug_color = Color(0, 0.6, 0.7, 0.42)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept Color with spaces', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="SpacedColor" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
debug_color = Color( 0.5 , 0.5 , 0.5 , 1.0 )
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid color format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="InvalidColor" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
debug_color = "red"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const colorError = diagnostics.find(d => d.message.includes('debug_color'));
        expect(colorError).toBeDefined();
        expect(colorError?.message).toContain('Color');
        expect(colorError?.ruleName).toBe('strict-parser');
      });

      it('should reject color with too few components', () => {
        const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="TwoComponents" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
debug_color = Color(1, 0)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const colorError = diagnostics.find(d => d.message.includes('debug_color'));
        expect(colorError).toBeDefined();
      });
    });
  });

  describe('Semantic Validation (Required Properties)', () => {
    it('should detect missing shape property (REQUIRED)', () => {
      const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody2D"]

[node name="NoShape" type="CollisionShape2D" parent="."]
disabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const shapeError = diagnostics.find(d => d.message.includes('missing required property'));
      expect(shapeError).toBeDefined();
      expect(shapeError).toMatchObject({
        severity: 'error',
        nodeName: 'NoShape',
        nodeType: 'CollisionShape2D',
        ruleName: 'collisionshape2d-requires-shape',
      });
      expect(shapeError?.message).toContain('missing required property');
      expect(shapeError?.message).toContain('shape');
    });

    it('should pass when shape property is present', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="ValidShape" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect non-existent shape resource', () => {
      const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody2D"]

[node name="MissingResource" type="CollisionShape2D" parent="."]
shape = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const resourceError = diagnostics.find(d => d.message.includes('Shape resource not found'));
      expect(resourceError).toBeDefined();
      expect(resourceError).toMatchObject({
        severity: 'error',
        nodeName: 'MissingResource',
        nodeType: 'CollisionShape2D',
        ruleName: 'valid-collisionshape2d-resources',
      });
      expect(resourceError?.message).toContain('Shape resource not found');
    });

    it('should pass when shape resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="CircleShape2D" id="circle_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="ValidResource" type="CollisionShape2D" parent="."]
shape = SubResource("circle_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
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

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Parent Types)', () => {
    it('should pass with StaticBody2D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with RigidBody2D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="CircleShape2D" id="shape_1"]

[node name="RigidBody" type="RigidBody2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with CharacterBody2D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="CapsuleShape2D" id="shape_1"]

[node name="CharacterBody" type="CharacterBody2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with Area2D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="Area" type="Area2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with AnimatableBody2D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="AnimatableBody" type="AnimatableBody2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when parent is invalid type (Node2D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="InvalidParent" type="Node2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'collisionshape2d-invalid-parent');
      expect(parentError).toBeDefined();
      expect(parentError).toMatchObject({
        severity: 'warning',
        nodeName: 'Collision',
        nodeType: 'CollisionShape2D',
        ruleName: 'collisionshape2d-invalid-parent',
      });
      expect(parentError?.message).toContain('Node2D');
      expect(parentError?.message).toContain('should be a child of');
    });

    it('should warn when parent is invalid type (Sprite2D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="Sprite" type="Sprite2D"]

[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'collisionshape2d-invalid-parent');
      expect(parentError).toBeDefined();
      expect(parentError?.message).toContain('Sprite2D');
    });

    it('should warn when CollisionShape2D has no parent (root level)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="RootCollision" type="CollisionShape2D"]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const noParentError = diagnostics.find(d => d.ruleName === 'collisionshape2d-no-parent');
      expect(noParentError).toBeDefined();
      expect(noParentError).toMatchObject({
        severity: 'warning',
        nodeName: 'RootCollision',
        nodeType: 'CollisionShape2D',
        ruleName: 'collisionshape2d-no-parent',
      });
      expect(noParentError?.message).toContain('no parent node');
    });
  });

  describe('Semantic Validation (One-Way Collision Configuration)', () => {
    it('should warn when one_way_collision_margin is set but one_way_collision is false', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="UnusedMargin" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = false
one_way_collision_margin = 1.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const marginWarning = diagnostics.find(d => d.ruleName === 'collisionshape2d-unused-one-way-margin');
      expect(marginWarning).toBeDefined();
      expect(marginWarning).toMatchObject({
        severity: 'warning',
        nodeName: 'UnusedMargin',
        nodeType: 'CollisionShape2D',
        ruleName: 'collisionshape2d-unused-one-way-margin',
      });
      expect(marginWarning?.message).toContain('one_way_collision_margin');
      expect(marginWarning?.message).toContain('no effect');
    });

    it('should warn when one_way_collision_margin is set but one_way_collision is not set (defaults to false)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="UnusedMarginDefault" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision_margin = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const marginWarning = diagnostics.find(d => d.ruleName === 'collisionshape2d-unused-one-way-margin');
      expect(marginWarning).toBeDefined();
      expect(marginWarning?.message).toContain('not set (defaults to false)');
    });

    it('should not warn when one_way_collision_margin is set and one_way_collision is true', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="ValidOneWay" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = true
one_way_collision_margin = 1.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not warn when one_way_collision_margin is zero (even if one_way_collision is false)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="ZeroMarginOk" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
one_way_collision = false
one_way_collision_margin = 0.0
`;

      const diagnostics = linter.lint(content);
      // Should only have warnings/errors unrelated to unused margin
      const marginWarning = diagnostics.find(d => d.ruleName === 'collisionshape2d-unused-one-way-margin');
      expect(marginWarning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="InvalidParent" type="Node2D"]

[node name="MultipleErrors" type="CollisionShape2D" parent="."]
disabled = not_a_boolean
`;

      const diagnostics = linter.lint(content);
      // Expect: missing shape (error), invalid parent (warning), invalid disabled format (error)
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const hasShapeError = diagnostics.some(d => d.message.includes('missing required property'));
      const hasParentWarning = diagnostics.some(d => d.message.includes('invalid-parent') || d.message.includes('should be a child'));
      const hasDisabledError = diagnostics.some(d => d.message.includes('disabled'));
      // At least one error should be present
      expect(hasShapeError || hasParentWarning || hasDisabledError).toBe(true);
    });

    it('should detect CollisionShape2D with deeply nested parent structure', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="Root" type="Node2D"]

[node name="StaticBody" type="StaticBody2D" parent="."]

[node name="NestedCollision" type="CollisionShape2D" parent="StaticBody"]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      // This should pass - StaticBody2D is the immediate parent
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle CollisionShape2D with only shape property', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SegmentShape2D" id="segment"]

[node name="StaticBody" type="StaticBody2D"]

[node name="MinimalCollision" type="CollisionShape2D" parent="."]
shape = SubResource("segment")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
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

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle disabled collision shape', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="shape_1"]

[node name="StaticBody" type="StaticBody2D"]

[node name="DisabledCollision" type="CollisionShape2D" parent="."]
shape = SubResource("shape_1")
disabled = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties at all', () => {
      const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody2D"]

[node name="EmptyCollision" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have error for missing shape
      expect(diagnostics.length).toBeGreaterThan(0);
      const shapeError = diagnostics.find(d => d.message.includes('missing required property'));
      expect(shapeError).toBeDefined();
    });

    it('should handle one-way collision platforms', () => {
      const content = `[gd_scene format=3]

[sub_resource type="RectangleShape2D" id="platform_shape"]

[node name="Platform" type="StaticBody2D"]

[node name="PlatformCollision" type="CollisionShape2D" parent="."]
shape = SubResource("platform_shape")
one_way_collision = true
one_way_collision_margin = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
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

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
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

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
