/**
 * Tests for StaticBody2D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('StaticBody2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid StaticBody2D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="physics_mat_1"]

[node name="ValidStaticBody" type="StaticBody2D"]
physics_material_override = SubResource("physics_mat_1")
constant_linear_velocity = Vector2(0, 0)
constant_angular_velocity = 0.0
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
input_pickable = true

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody2D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMaterial" type="StaticBody2D"]
physics_material_override = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('physics_material_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('resource reference');
      });
    });

    describe('constant_linear_velocity validation', () => {
      it('should accept valid constant_linear_velocity format', () => {
        const content = `[gd_scene format=3]

[node name="ValidVelocity" type="StaticBody2D"]
constant_linear_velocity = Vector2(1.0, 0.5)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        // Should have warning about non-zero velocity, but no format errors
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should accept zero constant_linear_velocity', () => {
        const content = `[gd_scene format=3]

[node name="ZeroVelocity" type="StaticBody2D"]
constant_linear_velocity = Vector2(0, 0)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid constant_linear_velocity format (wrong number of components)', () => {
        const content = `[gd_scene format=3]

[node name="InvalidVelocity" type="StaticBody2D"]
constant_linear_velocity = Vector2(1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('constant_linear_velocity'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector2 with 2 numbers');
      });

      it('should reject Vector3 used for constant_linear_velocity', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFormat" type="StaticBody2D"]
constant_linear_velocity = Vector3(1, 2, 3)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('constant_linear_velocity'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector2 with 2 numbers');
      });

      it('should reject non-Vector2 constant_linear_velocity', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFormat" type="StaticBody2D"]
constant_linear_velocity = 1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('constant_linear_velocity'));
        expect(error).toBeDefined();
      });
    });

    describe('constant_angular_velocity validation', () => {
      it('should accept valid constant_angular_velocity format', () => {
        const content = `[gd_scene format=3]

[node name="ValidAngular" type="StaticBody2D"]
constant_angular_velocity = 1.57

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        // Should have warning about non-zero velocity, but no format errors
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should accept zero constant_angular_velocity', () => {
        const content = `[gd_scene format=3]

[node name="ZeroAngular" type="StaticBody2D"]
constant_angular_velocity = 0.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative constant_angular_velocity', () => {
        const content = `[gd_scene format=3]

[node name="NegativeAngular" type="StaticBody2D"]
constant_angular_velocity = -3.14

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        // Should have warning about non-zero velocity, but no format errors
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject non-numeric constant_angular_velocity', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAngular" type="StaticBody2D"]
constant_angular_velocity = "fast"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('constant_angular_velocity'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('must be a number');
      });
    });

    describe('collision_layer validation', () => {
      it('should accept valid collision_layer values', () => {
        const validValues = [1, 100, 1048575]; // Non-zero values to avoid warning

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLayer${value}" type="StaticBody2D"]
collision_layer = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should accept maximum collision_layer value', () => {
        const content = `[gd_scene format=3]

[node name="MaxLayer" type="StaticBody2D"]
collision_layer = 1048575

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative collision_layer', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLayer" type="StaticBody2D"]
collision_layer = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_layer'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });

      it('should reject collision_layer exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveLayer" type="StaticBody2D"]
collision_layer = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_layer'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });

      it('should reject non-numeric collision_layer', () => {
        const content = `[gd_scene format=3]

[node name="InvalidLayer" type="StaticBody2D"]
collision_layer = "invalid"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_layer'));
        expect(error).toBeDefined();
      });
    });

    describe('collision_mask validation', () => {
      it('should accept valid collision_mask values', () => {
        const validValues = [1, 255, 1048575]; // Non-zero values to avoid warning

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMask${value}" type="StaticBody2D"]
collision_mask = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative collision_mask', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMask" type="StaticBody2D"]
collision_mask = -5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_mask'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });

      it('should reject collision_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveMask" type="StaticBody2D"]
collision_mask = 5000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_mask'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });
    });

    describe('collision_priority validation', () => {
      it('should accept valid collision_priority values', () => {
        const validValues = [0.0, 0.5, 1.0, -1.0, 100.5];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidPriority${value}" type="StaticBody2D"]
collision_priority = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric collision_priority', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPriority" type="StaticBody2D"]
collision_priority = "high"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_priority'));
        expect(error).toBeDefined();
      });
    });

    describe('input_pickable validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="PickableTrue" type="StaticBody2D"]
input_pickable = true

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="PickableFalse" type="StaticBody2D"]
input_pickable = false

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean input_pickable', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPickable" type="StaticBody2D"]
input_pickable = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('input_pickable'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMaterial" type="StaticBody2D"]
physics_material_override = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const error = diagnostics.find(d => d.message.includes('Physics material resource not found'));
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        nodeType: 'StaticBody2D',
        ruleName: 'valid-staticbody2d-resources',
      });
    });

    it('should pass when physics_material_override resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody2D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept ExtResource references', () => {
      const content = `[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="StaticBody2D"]
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (CollisionShape2D Children)', () => {
    it('should warn when StaticBody2D has no CollisionShape2D children', () => {
      const content = `[gd_scene format=3]

[node name="NoCollisionShape" type="StaticBody2D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-needs-collision-shape');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody2D',
      });
      expect(warning?.message).toContain('no CollisionShape2D children');
    });

    it('should pass when StaticBody2D has CollisionShape2D child', () => {
      const content = `[gd_scene format=3]

[node name="WithCollisionShape" type="StaticBody2D"]

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when StaticBody2D has nested CollisionShape2D', () => {
      const content = `[gd_scene format=3]

[node name="WithNestedShape" type="StaticBody2D"]

[node name="Container" type="Node2D" parent="."]

[node name="CollisionShape2D" type="CollisionShape2D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when StaticBody2D has multiple CollisionShape2D children', () => {
      const content = `[gd_scene format=3]

[node name="MultipleShapes" type="StaticBody2D"]

[node name="Shape1" type="CollisionShape2D" parent="."]

[node name="Shape2" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Constant Velocities)', () => {
    it('should warn when constant_linear_velocity is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="MovingStatic" type="StaticBody2D"]
constant_linear_velocity = Vector2(1.0, 0.0)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-constant-velocity-warning');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody2D',
      });
      expect(warning?.message).toContain('constant_linear_velocity');
      expect(warning?.message).toContain('confusing');
    });

    it('should not warn when constant_linear_velocity is zero', () => {
      const content = `[gd_scene format=3]

[node name="StaticStatic" type="StaticBody2D"]
constant_linear_velocity = Vector2(0, 0)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when constant_angular_velocity is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="RotatingStatic" type="StaticBody2D"]
constant_angular_velocity = 1.57

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-constant-velocity-warning');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody2D',
      });
      expect(warning?.message).toContain('constant_angular_velocity');
      expect(warning?.message).toContain('confusing');
    });

    it('should not warn when constant_angular_velocity is zero', () => {
      const content = `[gd_scene format=3]

[node name="StaticStatic" type="StaticBody2D"]
constant_angular_velocity = 0.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when both velocities are non-zero', () => {
      const content = `[gd_scene format=3]

[node name="DoubleVelocity" type="StaticBody2D"]
constant_linear_velocity = Vector2(1.0, 0.0)
constant_angular_velocity = 1.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warnings = diagnostics.filter(d => d.ruleName === 'staticbody2d-constant-velocity-warning');
      expect(warnings.length).toBe(2); // One for linear, one for angular
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoLayer" type="StaticBody2D"]
collision_layer = 0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-zero-collision-layer');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody2D',
      });
      expect(warning?.message).toContain('collision_layer set to 0');
    });

    it('should not warn when collision_layer is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithLayer" type="StaticBody2D"]
collision_layer = 1

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when collision_mask is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoMask" type="StaticBody2D"]
collision_mask = 0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-zero-collision-mask');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody2D',
      });
      expect(warning?.message).toContain('collision_mask set to 0');
    });

    it('should not warn when collision_mask is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithMask" type="StaticBody2D"]
collision_mask = 1

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="StaticBody2D"]
collision_layer = -5
physics_material_override = SubResource("nonexistent")
constant_linear_velocity = Vector2(1, 0)
`;

      const diagnostics = linter.lint(content);
      // Should have at least one error (format errors may prevent semantic checks)
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const hasCollisionLayerError = diagnostics.some(d => d.message.includes('collision_layer'));
      const hasResourceError = diagnostics.some(d => d.message.includes('resource not found'));
      const hasVelocityWarning = diagnostics.some(d => d.message.includes('constant_linear_velocity'));
      // At least one of these errors should be present
      expect(hasCollisionLayerError || hasResourceError || hasVelocityWarning).toBe(true);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ComplexStatic" type="StaticBody2D"]
physics_material_override = SubResource("mat_1")
constant_linear_velocity = Vector2(0, 0)
constant_angular_velocity = 0.0
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
input_pickable = true

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptyStatic" type="StaticBody2D"]
`;

      const diagnostics = linter.lint(content);
      // Should only have warning about missing CollisionShape2D
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].ruleName).toBe('staticbody2d-needs-collision-shape');
    });

    it('should handle scientific notation in velocities', () => {
      const content = `[gd_scene format=3]

[node name="ScientificNotation" type="StaticBody2D"]
constant_linear_velocity = Vector2(1e-5, 2.5e3)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have warning about non-zero velocity
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-constant-velocity-warning');
      expect(warning).toBeDefined();
    });

    it('should handle bitmask boundaries', () => {
      const content = `[gd_scene format=3]

[node name="BitmaskBoundary" type="StaticBody2D"]
collision_layer = 1048575
collision_mask = 1048575

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle negative angular velocity', () => {
      const content = `[gd_scene format=3]

[node name="NegativeRotation" type="StaticBody2D"]
constant_angular_velocity = -3.14159

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have warning about non-zero velocity
      const warning = diagnostics.find(d => d.ruleName === 'staticbody2d-constant-velocity-warning');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain('constant_angular_velocity');
    });

    it('should handle whitespace in Vector2', () => {
      const content = `[gd_scene format=3]

[node name="WhitespaceVector" type="StaticBody2D"]
constant_linear_velocity = Vector2(  10.5  ,  -20.3  )

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should only have warning about non-zero velocity
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });
});
