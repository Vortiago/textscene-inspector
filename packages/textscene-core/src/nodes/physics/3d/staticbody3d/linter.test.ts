/**
 * Tests for StaticBody3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('StaticBody3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid StaticBody3D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="physics_mat_1"]

[node name="ValidStaticBody" type="StaticBody3D"]
physics_material_override = SubResource("physics_mat_1")
constant_linear_velocity = Vector3(0, 0, 0)
constant_angular_velocity = Vector3(0, 0, 0)
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
disable_mode = 0
input_ray_pickable = true
input_capture_on_drag = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody3D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMaterial" type="StaticBody3D"]
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

[node name="ValidVelocity" type="StaticBody3D"]
constant_linear_velocity = Vector3(1.0, 0.0, 0.5)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        // Should have warning about non-zero velocity, but no format errors
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should accept zero constant_linear_velocity', () => {
        const content = `[gd_scene format=3]

[node name="ZeroVelocity" type="StaticBody3D"]
constant_linear_velocity = Vector3(0, 0, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid constant_linear_velocity format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidVelocity" type="StaticBody3D"]
constant_linear_velocity = Vector3(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('constant_linear_velocity'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector3 with 3 numbers');
      });

      it('should reject non-Vector3 constant_linear_velocity', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFormat" type="StaticBody3D"]
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

[node name="ValidAngular" type="StaticBody3D"]
constant_angular_velocity = Vector3(0.0, 1.57, 0.0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        // Should have warning about non-zero velocity, but no format errors
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should accept zero constant_angular_velocity', () => {
        const content = `[gd_scene format=3]

[node name="ZeroAngular" type="StaticBody3D"]
constant_angular_velocity = Vector3(0, 0, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid constant_angular_velocity format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAngular" type="StaticBody3D"]
constant_angular_velocity = Vector3(1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('constant_angular_velocity'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector3 with 3 numbers');
      });
    });

    describe('collision_layer validation', () => {
      it('should accept valid collision_layer values', () => {
        const validValues = [1, 100, 1048575]; // Non-zero values to avoid warning

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLayer${value}" type="StaticBody3D"]
collision_layer = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should accept maximum collision_layer value', () => {
        const content = `[gd_scene format=3]

[node name="MaxLayer" type="StaticBody3D"]
collision_layer = 1048575

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative collision_layer', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLayer" type="StaticBody3D"]
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

[node name="ExcessiveLayer" type="StaticBody3D"]
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

[node name="InvalidLayer" type="StaticBody3D"]
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

[node name="ValidMask${value}" type="StaticBody3D"]
collision_mask = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative collision_mask', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMask" type="StaticBody3D"]
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

[node name="ExcessiveMask" type="StaticBody3D"]
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

[node name="ValidPriority${value}" type="StaticBody3D"]
collision_priority = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric collision_priority', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPriority" type="StaticBody3D"]
collision_priority = "high"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_priority'));
        expect(error).toBeDefined();
      });
    });

    describe('disable_mode validation', () => {
      it('should accept all valid disable_mode values', () => {
        const validValues = [0, 1, 2]; // REMOVE, MAKE_STATIC, KEEP_ACTIVE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMode${value}" type="StaticBody3D"]
disable_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid disable_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMode" type="StaticBody3D"]
disable_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('disable_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-2');
        expect(error?.message).toContain('REMOVE');
      });

      it('should reject negative disable_mode', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMode" type="StaticBody3D"]
disable_mode = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('disable_mode'));
        expect(error).toBeDefined();
      });
    });

    describe('input_ray_pickable validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="PickableTrue" type="StaticBody3D"]
input_ray_pickable = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="PickableFalse" type="StaticBody3D"]
input_ray_pickable = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean input_ray_pickable', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPickable" type="StaticBody3D"]
input_ray_pickable = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('input_ray_pickable'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });

    describe('input_capture_on_drag validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="CaptureTrue" type="StaticBody3D"]
input_capture_on_drag = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="CaptureFalse" type="StaticBody3D"]
input_capture_on_drag = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean input_capture_on_drag', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCapture" type="StaticBody3D"]
input_capture_on_drag = "yes"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('input_capture_on_drag'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMaterial" type="StaticBody3D"]
physics_material_override = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const error = diagnostics.find(d => d.message.includes('Physics material resource not found'));
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        nodeType: 'StaticBody3D',
        ruleName: 'valid-staticbody3d-resources',
      });
    });

    it('should pass when physics_material_override resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody3D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept ExtResource references', () => {
      const content = `[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="StaticBody3D"]
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when StaticBody3D has no CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="NoCollisionShape" type="StaticBody3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody3d-needs-collision-shape');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody3D',
      });
      expect(warning?.message).toContain('no CollisionShape3D children');
    });

    it('should pass when StaticBody3D has CollisionShape3D child', () => {
      const content = `[gd_scene format=3]

[node name="WithCollisionShape" type="StaticBody3D"]

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when StaticBody3D has nested CollisionShape3D', () => {
      const content = `[gd_scene format=3]

[node name="WithNestedShape" type="StaticBody3D"]

[node name="Container" type="Node3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when StaticBody3D has multiple CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="MultipleShapes" type="StaticBody3D"]

[node name="Shape1" type="CollisionShape3D" parent="."]

[node name="Shape2" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Constant Velocities)', () => {
    it('should warn when constant_linear_velocity is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="MovingStatic" type="StaticBody3D"]
constant_linear_velocity = Vector3(1.0, 0.0, 0.0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody3d-constant-velocity-warning');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody3D',
      });
      expect(warning?.message).toContain('constant_linear_velocity');
      expect(warning?.message).toContain('confusing');
    });

    it('should not warn when constant_linear_velocity is zero', () => {
      const content = `[gd_scene format=3]

[node name="StaticStatic" type="StaticBody3D"]
constant_linear_velocity = Vector3(0, 0, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when constant_angular_velocity is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="RotatingStatic" type="StaticBody3D"]
constant_angular_velocity = Vector3(0.0, 1.57, 0.0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody3d-constant-velocity-warning');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody3D',
      });
      expect(warning?.message).toContain('constant_angular_velocity');
      expect(warning?.message).toContain('confusing');
    });

    it('should not warn when constant_angular_velocity is zero', () => {
      const content = `[gd_scene format=3]

[node name="StaticStatic" type="StaticBody3D"]
constant_angular_velocity = Vector3(0, 0, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when both velocities are non-zero', () => {
      const content = `[gd_scene format=3]

[node name="DoubleVelocity" type="StaticBody3D"]
constant_linear_velocity = Vector3(1.0, 0.0, 0.0)
constant_angular_velocity = Vector3(0.0, 1.0, 0.0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warnings = diagnostics.filter(d => d.ruleName === 'staticbody3d-constant-velocity-warning');
      expect(warnings.length).toBe(2); // One for linear, one for angular
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoLayer" type="StaticBody3D"]
collision_layer = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody3d-zero-collision-layer');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody3D',
      });
      expect(warning?.message).toContain('collision_layer set to 0');
    });

    it('should not warn when collision_layer is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithLayer" type="StaticBody3D"]
collision_layer = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when collision_mask is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoMask" type="StaticBody3D"]
collision_mask = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'staticbody3d-zero-collision-mask');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'StaticBody3D',
      });
      expect(warning?.message).toContain('collision_mask set to 0');
    });

    it('should not warn when collision_mask is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithMask" type="StaticBody3D"]
collision_mask = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="StaticBody3D"]
disable_mode = 10
collision_layer = -5
physics_material_override = SubResource("nonexistent")
constant_linear_velocity = Vector3(1, 0, 0)
`;

      const diagnostics = linter.lint(content);
      // Should have multiple errors: disable_mode, collision_layer format errors,
      // plus potentially resource not found and velocity warnings
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
      const hasDisableModeError = diagnostics.some(d => d.message.includes('disable_mode'));
      const hasCollisionLayerError = diagnostics.some(d => d.message.includes('collision_layer'));
      expect(hasDisableModeError || hasCollisionLayerError).toBe(true);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ComplexStatic" type="StaticBody3D"]
physics_material_override = SubResource("mat_1")
constant_linear_velocity = Vector3(0, 0, 0)
constant_angular_velocity = Vector3(0, 0, 0)
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
disable_mode = 0
input_ray_pickable = true
input_capture_on_drag = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptyStatic" type="StaticBody3D"]
`;

      const diagnostics = linter.lint(content);
      // Should only have warning about missing CollisionShape3D
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].ruleName).toBe('staticbody3d-needs-collision-shape');
    });

    it('should handle scientific notation in velocities', () => {
      const content = `[gd_scene format=3]

[node name="ScientificNotation" type="StaticBody3D"]
constant_linear_velocity = Vector3(1e-5, 2.5e3, -3.14e2)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have warning about non-zero velocity
      const warning = diagnostics.find(d => d.ruleName === 'staticbody3d-constant-velocity-warning');
      expect(warning).toBeDefined();
    });

    it('should handle bitmask boundaries', () => {
      const content = `[gd_scene format=3]

[node name="BitmaskBoundary" type="StaticBody3D"]
collision_layer = 1048575
collision_mask = 1048575

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
