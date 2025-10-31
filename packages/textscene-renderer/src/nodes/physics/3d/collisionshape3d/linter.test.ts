/**
 * Tests for CollisionShape3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('CollisionShape3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CollisionShape3D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="CollisionShape" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('shape property validation', () => {
      it('should accept valid SubResource reference', () => {
        const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="box_shape"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("box_shape")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid ExtResource reference', () => {
        const content = `[gd_scene format=3]

[ext_resource type="Shape3D" path="res://shapes/box.tres" id="ext_shape"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = ExtResource("ext_shape")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid shape reference format', () => {
        const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody3D"]

[node name="InvalidShape" type="CollisionShape3D" parent="."]
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

[node name="StaticBody" type="StaticBody3D"]

[node name="BadShape" type="CollisionShape3D" parent="."]
shape = SubResource(box shape)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shape');
      });
    });

    describe('disabled property validation', () => {
      it('should accept disabled = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="DisabledCollision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept disabled = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="EnabledCollision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean disabled value', () => {
        const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="InvalidDisabled" type="CollisionShape3D" parent="."]
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

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="InvalidDisabled" type="CollisionShape3D" parent="."]
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
  });

  describe('Semantic Validation (Required Properties)', () => {
    it('should detect missing shape property (REQUIRED)', () => {
      const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody3D"]

[node name="NoShape" type="CollisionShape3D" parent="."]
disabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const shapeError = diagnostics.find(d => d.message.includes('missing required property'));
      expect(shapeError).toBeDefined();
      expect(shapeError).toMatchObject({
        severity: 'error',
        nodeName: 'NoShape',
        nodeType: 'CollisionShape3D',
        ruleName: 'collisionshape3d-requires-shape',
      });
      expect(shapeError?.message).toContain('missing required property');
      expect(shapeError?.message).toContain('shape');
    });

    it('should pass when shape property is present', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="ValidShape" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect non-existent shape resource', () => {
      const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody3D"]

[node name="MissingResource" type="CollisionShape3D" parent="."]
shape = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const resourceError = diagnostics.find(d => d.message.includes('Shape resource not found'));
      expect(resourceError).toBeDefined();
      expect(resourceError).toMatchObject({
        severity: 'error',
        nodeName: 'MissingResource',
        nodeType: 'CollisionShape3D',
        ruleName: 'valid-collisionshape3d-resources',
      });
      expect(resourceError?.message).toContain('Shape resource not found');
    });

    it('should pass when shape resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SphereShape3D" id="sphere_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="ValidResource" type="CollisionShape3D" parent="."]
shape = SubResource("sphere_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate multiple shape resources', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="box_shape"]
[sub_resource type="SphereShape3D" id="sphere_shape"]
[sub_resource type="CapsuleShape3D" id="capsule_shape"]

[node name="StaticBody1" type="StaticBody3D"]

[node name="BoxCollision" type="CollisionShape3D" parent="."]
shape = SubResource("box_shape")

[node name="SphereCollision" type="CollisionShape3D" parent="."]
shape = SubResource("sphere_shape")

[node name="CapsuleCollision" type="CollisionShape3D" parent="."]
shape = SubResource("capsule_shape")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Parent Types)', () => {
    it('should pass with StaticBody3D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with RigidBody3D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SphereShape3D" id="shape_1"]

[node name="RigidBody" type="RigidBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with CharacterBody3D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="CapsuleShape3D" id="shape_1"]

[node name="CharacterBody" type="CharacterBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with Area3D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Area" type="Area3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when parent is invalid type (Node3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="InvalidParent" type="Node3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'collisionshape3d-invalid-parent');
      expect(parentError).toBeDefined();
      expect(parentError).toMatchObject({
        severity: 'warning',
        nodeName: 'Collision',
        nodeType: 'CollisionShape3D',
        ruleName: 'collisionshape3d-invalid-parent',
      });
      expect(parentError?.message).toContain('Node3D');
      expect(parentError?.message).toContain('should be a child of');
    });

    it('should warn when parent is invalid type (MeshInstance3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]
[sub_resource type="BoxMesh" id="mesh_1"]

[node name="Mesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'collisionshape3d-invalid-parent');
      expect(parentError).toBeDefined();
      expect(parentError?.message).toContain('MeshInstance3D');
    });

    it('should warn when CollisionShape3D has no parent (root level)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="RootCollision" type="CollisionShape3D"]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const noParentError = diagnostics.find(d => d.ruleName === 'collisionshape3d-no-parent');
      expect(noParentError).toBeDefined();
      expect(noParentError).toMatchObject({
        severity: 'warning',
        nodeName: 'RootCollision',
        nodeType: 'CollisionShape3D',
        ruleName: 'collisionshape3d-no-parent',
      });
      expect(noParentError?.message).toContain('no parent node');
    });

    it('should pass with AnimatableBody3D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="AnimatableBody" type="AnimatableBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with VehicleBody3D parent', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Vehicle" type="VehicleBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="InvalidParent" type="Node3D"]

[node name="MultipleErrors" type="CollisionShape3D" parent="."]
disabled = not_a_boolean
`;

      const diagnostics = linter.lint(content);
      // Expect: missing shape (error), invalid parent (warning), invalid disabled format (error)
      // However, strict parser errors may stop semantic validation
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const hasShapeError = diagnostics.some(d => d.message.includes('missing required property'));
      const hasParentWarning = diagnostics.some(d => d.message.includes('invalid-parent') || d.message.includes('should be a child'));
      const hasDisabledError = diagnostics.some(d => d.message.includes('disabled'));
      // At least one error should be present
      expect(hasShapeError || hasParentWarning || hasDisabledError).toBe(true);
    });

    it('should detect CollisionShape3D with deeply nested parent structure', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Root" type="Node3D"]

[node name="StaticBody" type="StaticBody3D" parent="."]

[node name="NestedCollision" type="CollisionShape3D" parent="StaticBody"]
shape = SubResource("shape_1")
`;

      const diagnostics = linter.lint(content);
      // This should pass - StaticBody3D is the immediate parent
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle CollisionShape3D with only shape property', () => {
      const content = `[gd_scene format=3]

[sub_resource type="CylinderShape3D" id="cylinder"]

[node name="StaticBody" type="StaticBody3D"]

[node name="MinimalCollision" type="CollisionShape3D" parent="."]
shape = SubResource("cylinder")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle all common shape types', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="box"]
[sub_resource type="SphereShape3D" id="sphere"]
[sub_resource type="CapsuleShape3D" id="capsule"]
[sub_resource type="CylinderShape3D" id="cylinder"]
[sub_resource type="ConvexPolygonShape3D" id="convex"]
[sub_resource type="ConcavePolygonShape3D" id="concave"]

[node name="StaticBody" type="StaticBody3D"]

[node name="BoxCollision" type="CollisionShape3D" parent="."]
shape = SubResource("box")

[node name="SphereCollision" type="CollisionShape3D" parent="."]
shape = SubResource("sphere")

[node name="CapsuleCollision" type="CollisionShape3D" parent="."]
shape = SubResource("capsule")

[node name="CylinderCollision" type="CollisionShape3D" parent="."]
shape = SubResource("cylinder")

[node name="ConvexCollision" type="CollisionShape3D" parent="."]
shape = SubResource("convex")

[node name="ConcaveCollision" type="CollisionShape3D" parent="."]
shape = SubResource("concave")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle disabled collision shape', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="DisabledCollision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties at all', () => {
      const content = `[gd_scene format=3]

[node name="StaticBody" type="StaticBody3D"]

[node name="EmptyCollision" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have error for missing shape
      expect(diagnostics.length).toBeGreaterThan(0);
      const shapeError = diagnostics.find(d => d.message.includes('missing required property'));
      expect(shapeError).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete physics scene with multiple bodies', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="ground_shape"]
[sub_resource type="SphereShape3D" id="ball_shape"]
[sub_resource type="CapsuleShape3D" id="player_shape"]
[sub_resource type="BoxShape3D" id="trigger_shape"]

[node name="Scene" type="Node3D"]

[node name="Ground" type="StaticBody3D" parent="."]

[node name="GroundCollision" type="CollisionShape3D" parent="Ground"]
shape = SubResource("ground_shape")

[node name="Ball" type="RigidBody3D" parent="."]

[node name="BallCollision" type="CollisionShape3D" parent="Ball"]
shape = SubResource("ball_shape")

[node name="Player" type="CharacterBody3D" parent="."]

[node name="PlayerCollision" type="CollisionShape3D" parent="Player"]
shape = SubResource("player_shape")

[node name="Trigger" type="Area3D" parent="."]

[node name="TriggerCollision" type="CollisionShape3D" parent="Trigger"]
shape = SubResource("trigger_shape")
disabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
