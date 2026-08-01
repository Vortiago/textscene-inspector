/**
 * Tests for StaticBody3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  collisionShape3d,
  expectClean,
  expectDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('StaticBody3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid StaticBody3D properties', () => {
      expectClean(`[gd_scene format=3]

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
`);
    });

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody3D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
      });

      it('should reject invalid physics_material_override format', () => {
        expectDiagnostic(
          scene(node('StaticBody3D', { physics_material_override: '"invalid_format"' })),
          { prop: 'physics_material_override', contains: ['resource reference'] }
        );
      });
    });

    describe('constant_linear_velocity validation', () => {
      it('should accept valid constant_linear_velocity format', () => {
        // Should have warning about non-zero velocity, but no format errors
        expectNoErrors(
          scene(node('StaticBody3D', { constant_linear_velocity: 'Vector3(1.0, 0.0, 0.5)' }), collisionShape3d)
        );
      });

      it('should accept zero constant_linear_velocity', () => {
        expectClean(scene(node('StaticBody3D', { constant_linear_velocity: 'Vector3(0, 0, 0)' }), collisionShape3d));
      });

      it('should reject invalid constant_linear_velocity format', () => {
        expectDiagnostic(
          scene(node('StaticBody3D', { constant_linear_velocity: 'Vector3(1, 2)' })),
          { prop: 'constant_linear_velocity', contains: ['Vector3 with 3 numbers'] }
        );
      });

      it('should reject non-Vector3 constant_linear_velocity', () => {
        expectDiagnostic(
          scene(node('StaticBody3D', { constant_linear_velocity: 1.0 })),
          { prop: 'constant_linear_velocity' }
        );
      });
    });

    describe('constant_angular_velocity validation', () => {
      it('should accept valid constant_angular_velocity format', () => {
        // Should have warning about non-zero velocity, but no format errors
        expectNoErrors(
          scene(node('StaticBody3D', { constant_angular_velocity: 'Vector3(0.0, 1.57, 0.0)' }), collisionShape3d)
        );
      });

      it('should accept zero constant_angular_velocity', () => {
        expectClean(scene(node('StaticBody3D', { constant_angular_velocity: 'Vector3(0, 0, 0)' }), collisionShape3d));
      });

      it('should reject invalid constant_angular_velocity format', () => {
        expectDiagnostic(
          scene(node('StaticBody3D', { constant_angular_velocity: 'Vector3(1)' })),
          { prop: 'constant_angular_velocity', contains: ['Vector3 with 3 numbers'] }
        );
      });
    });

    runPropertyValidation({ nodeType: 'StaticBody3D', acceptChild: collisionShape3d }, [
      {
          prop: 'collision_layer',
          valid: [1, 100, 1048575, 2000000, 2147483648, 4294967295],
          invalid: [
{ value: -1, contains: ['must be between 0 and 4294967295'] },
          { value: '"invalid"' },
          ],
        },
      {
          prop: 'collision_mask',
          valid: [1, 255, 1048575, 5000000, 2147483648, 4294967295],
          invalid: [
{ value: -5, contains: ['must be between 0 and 4294967295'] },
          ],
        },
      {
        prop: 'collision_priority',
        valid: [0.0, 0.5, 1.0, -1.0, 100.5],
        invalid: [{ value: '"high"' }],
      },
      {
        prop: 'disable_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2', 'REMOVE'] }, { value: -1 }],
      },
      {
        prop: 'input_ray_pickable',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'input_capture_on_drag',
        valid: [true, false],
        invalid: [{ value: '"yes"', contains: ['boolean'] }],
      },
    ]);
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      expectDiagnostic(
        scene(node('StaticBody3D', { physics_material_override: 'SubResource("nonexistent")' })),
        {
          ruleName: 'valid-staticbody3d-resources',
          severity: 'error',
          nodeType: 'StaticBody3D',
          contains: ['Physics material resource not found'],
        }
      );
    });

    it('should pass when physics_material_override resource exists', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody3D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
    });

    it('should accept ExtResource references', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="StaticBody3D"]
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
    });
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when StaticBody3D has no CollisionShape3D children', () => {
      expectDiagnostic(scene(node('StaticBody3D')), {
        ruleName: 'staticbody3d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'StaticBody3D',
        contains: ['no CollisionShape3D children'],
      });
    });

    it('should pass when StaticBody3D has CollisionShape3D child', () => {
      expectClean(scene(node('StaticBody3D'), collisionShape3d));
    });

    it('should pass when StaticBody3D has nested CollisionShape3D', () => {
      expectClean(
        scene(
          node('StaticBody3D'),
          node('Node3D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape3D', {}, { parent: 'Container' })
        )
      );
    });

    it('should pass when StaticBody3D has multiple CollisionShape3D children', () => {
      expectClean(
        scene(
          node('StaticBody3D'),
          node('CollisionShape3D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape3D', {}, { name: 'Shape2', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Constant Velocities)', () => {
    it('should warn when constant_linear_velocity is non-zero', () => {
      expectDiagnostic(
        scene(node('StaticBody3D', { constant_linear_velocity: 'Vector3(1.0, 0.0, 0.0)' }), collisionShape3d),
        {
          ruleName: 'staticbody3d-constant-velocity-warning',
          severity: 'warning',
          nodeType: 'StaticBody3D',
          contains: ['constant_linear_velocity', 'confusing'],
        }
      );
    });

    it('should not warn when constant_linear_velocity is zero', () => {
      expectClean(scene(node('StaticBody3D', { constant_linear_velocity: 'Vector3(0, 0, 0)' }), collisionShape3d));
    });

    it('should warn when constant_angular_velocity is non-zero', () => {
      expectDiagnostic(
        scene(node('StaticBody3D', { constant_angular_velocity: 'Vector3(0.0, 1.57, 0.0)' }), collisionShape3d),
        {
          ruleName: 'staticbody3d-constant-velocity-warning',
          severity: 'warning',
          nodeType: 'StaticBody3D',
          contains: ['constant_angular_velocity', 'confusing'],
        }
      );
    });

    it('should not warn when constant_angular_velocity is zero', () => {
      expectClean(scene(node('StaticBody3D', { constant_angular_velocity: 'Vector3(0, 0, 0)' }), collisionShape3d));
    });

    it('should warn when both velocities are non-zero', () => {
      const warnings = lint(
        scene(
          node('StaticBody3D', {
            constant_linear_velocity: 'Vector3(1.0, 0.0, 0.0)',
            constant_angular_velocity: 'Vector3(0.0, 1.0, 0.0)',
          }),
          collisionShape3d
        )
      ).filter(d => d.ruleName === 'staticbody3d-constant-velocity-warning');
      expect(warnings.length).toBe(2); // One for linear, one for angular
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      expectDiagnostic(scene(node('StaticBody3D', { collision_layer: 0 }), collisionShape3d), {
        ruleName: 'staticbody3d-zero-collision-layer',
        severity: 'warning',
        nodeType: 'StaticBody3D',
        contains: ['collision_layer set to 0'],
      });
    });

    it('should not warn when collision_layer is non-zero', () => {
      expectClean(scene(node('StaticBody3D', { collision_layer: 1 }), collisionShape3d));
    });

    it('should warn when collision_mask is 0', () => {
      expectDiagnostic(scene(node('StaticBody3D', { collision_mask: 0 }), collisionShape3d), {
        ruleName: 'staticbody3d-zero-collision-mask',
        severity: 'warning',
        nodeType: 'StaticBody3D',
        contains: ['collision_mask set to 0'],
      });
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectClean(scene(node('StaticBody3D', { collision_mask: 1 }), collisionShape3d));
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(`[gd_scene format=3]

[node name="MultipleErrors" type="StaticBody3D"]
disable_mode = 10
collision_layer = -5
physics_material_override = SubResource("nonexistent")
constant_linear_velocity = Vector3(1, 0, 0)
`);
      // Should have multiple errors: disable_mode, collision_layer format errors,
      // plus potentially resource not found and velocity warnings
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
      const hasDisableModeError = diagnostics.some(d => d.message.includes('disable_mode'));
      const hasCollisionLayerError = diagnostics.some(d => d.message.includes('collision_layer'));
      expect(hasDisableModeError || hasCollisionLayerError).toBe(true);
    });

    it('should handle all properties together', () => {
      expectClean(`[gd_scene format=3]

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
`);
    });

    it('should handle node with no properties', () => {
      const diagnostics = lint(scene(node('StaticBody3D')));
      // Should only have warning about missing CollisionShape3D
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]!.ruleName).toBe('staticbody3d-needs-collision-shape');
    });

    it('should handle scientific notation in velocities', () => {
      // Should have warning about non-zero velocity
      expectDiagnostic(
        scene(node('StaticBody3D', { constant_linear_velocity: 'Vector3(1e-5, 2.5e3, -3.14e2)' }), collisionShape3d),
        { ruleName: 'staticbody3d-constant-velocity-warning' }
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(scene(node('StaticBody3D', { collision_layer: 1048575, collision_mask: 1048575 }), collisionShape3d));
    });
  });
});
