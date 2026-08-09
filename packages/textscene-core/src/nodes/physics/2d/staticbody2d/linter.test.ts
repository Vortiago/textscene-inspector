/**
 * Tests for StaticBody2D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  collisionShape2d,
  expectClean,
  expectDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('StaticBody2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid StaticBody2D properties', () => {
      expectClean(`[gd_scene format=3]

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
`);
    });

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody2D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
      });

      it('should reject invalid physics_material_override format', () => {
        expectDiagnostic(
          scene(node('StaticBody2D', { physics_material_override: '"invalid_format"' })),
          { prop: 'physics_material_override', contains: ['resource reference'] }
        );
      });
    });

    describe('constant_linear_velocity validation', () => {
      it('should accept valid constant_linear_velocity format', () => {
        // Should have warning about non-zero velocity, but no format errors
        expectNoErrors(
          scene(node('StaticBody2D', { constant_linear_velocity: 'Vector2(1.0, 0.5)' }), collisionShape2d)
        );
      });

      it('should accept zero constant_linear_velocity', () => {
        expectClean(scene(node('StaticBody2D', { constant_linear_velocity: 'Vector2(0, 0)' }), collisionShape2d));
      });

      it('should reject invalid constant_linear_velocity format (wrong number of components)', () => {
        expectDiagnostic(scene(node('StaticBody2D', { constant_linear_velocity: 'Vector2(1)' })), {
          prop: 'constant_linear_velocity',
          contains: ['Vector2 with 2 numbers'],
        });
      });

      it('should reject Vector3 used for constant_linear_velocity', () => {
        expectDiagnostic(
          scene(node('StaticBody2D', { constant_linear_velocity: 'Vector3(1, 2, 3)' })),
          { prop: 'constant_linear_velocity', contains: ['Vector2 with 2 numbers'] }
        );
      });

      it('should reject non-Vector2 constant_linear_velocity', () => {
        expectDiagnostic(scene(node('StaticBody2D', { constant_linear_velocity: 1.0 })), {
          prop: 'constant_linear_velocity',
        });
      });
    });

    describe('constant_angular_velocity validation', () => {
      it('should accept valid constant_angular_velocity format', () => {
        // Should have warning about non-zero velocity, but no format errors
        expectNoErrors(scene(node('StaticBody2D', { constant_angular_velocity: 1.57 }), collisionShape2d));
      });

      it('should accept zero constant_angular_velocity', () => {
        expectClean(scene(node('StaticBody2D', { constant_angular_velocity: 0.0 }), collisionShape2d));
      });

      it('should accept negative constant_angular_velocity', () => {
        // Should have warning about non-zero velocity, but no format errors
        expectNoErrors(scene(node('StaticBody2D', { constant_angular_velocity: -3.14 }), collisionShape2d));
      });

      it('should reject non-numeric constant_angular_velocity', () => {
        expectDiagnostic(scene(node('StaticBody2D', { constant_angular_velocity: '"fast"' })), {
          prop: 'constant_angular_velocity',
          contains: ['must be a number'],
        });
      });
    });

    runPropertyValidation({ nodeType: 'StaticBody2D', acceptChild: collisionShape2d }, [
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
        prop: 'input_pickable',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
    ]);
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      expectDiagnostic(
        scene(node('StaticBody2D', { physics_material_override: 'SubResource("nonexistent")' })),
        {
          ruleName: 'valid-staticbody2d-resources',
          severity: 'error',
          nodeType: 'StaticBody2D',
          contains: ['Physics material resource not found'],
        }
      );
    });

    it('should pass when physics_material_override resource exists', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="StaticBody2D"]
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
    });

    it('should accept ExtResource references', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="StaticBody2D"]
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
    });
  });

  describe('Semantic Validation (CollisionShape2D Children)', () => {
    it('should warn when StaticBody2D has no CollisionShape2D or CollisionPolygon2D children', () => {
      expectDiagnostic(scene(node('StaticBody2D')), {
        ruleName: 'staticbody2d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'StaticBody2D',
        contains: ['no CollisionShape2D or CollisionPolygon2D children'],
      });
    });

    it('should pass when StaticBody2D has CollisionShape2D child', () => {
      expectClean(scene(node('StaticBody2D'), collisionShape2d));
    });

    // A shape under an intervening node registers with nothing: `_notification`
    // attaches on `Object::cast_to<CollisionObject2D>(get_parent())`
    // (collision_shape_2d.cpp:55), so this body's `shapes` map stays empty and
    // Godot raises its own warning (collision_object_2d.cpp:587).
    it('warns when the only CollisionShape2D under StaticBody2D sits below an intervening node', () => {
      expectDiagnostic(
        scene(
          node('StaticBody2D'),
          node('Node2D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape2D', {}, { parent: 'Container' })
        ),
        { ruleName: 'staticbody2d-needs-collision-shape', severity: 'warning' }
      );
    });

    it('should pass when StaticBody2D has multiple CollisionShape2D children', () => {
      expectClean(
        scene(
          node('StaticBody2D'),
          node('CollisionShape2D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape2D', {}, { name: 'Shape2', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should not warn when collision_layer is non-zero', () => {
      expectClean(scene(node('StaticBody2D', { collision_layer: 1 }), collisionShape2d));
    });

    // No `collision_mask == 0` check: no engine warning exists for it, and it
    // is the standard "only needs to BE detected" static configuration
    // (squash-the-creeps' Ground/Walls, the platformer's PlatformStatic,
    // dodge-the-creeps' Mob all ship with it).
    it('stays quiet when collision_mask is 0', () => {
      expectClean(scene(node('StaticBody2D', { collision_mask: 0 }), collisionShape2d));
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectClean(scene(node('StaticBody2D', { collision_mask: 1 }), collisionShape2d));
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('StaticBody2D', {
            collision_layer: -5,
            physics_material_override: 'SubResource("nonexistent")',
          })
        )
      );
      // Should have at least one error (format errors may prevent semantic checks)
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const hasCollisionLayerError = diagnostics.some(d => d.message.includes('collision_layer'));
      const hasResourceError = diagnostics.some(d => d.message.includes('resource not found'));
      // At least one of these errors should be present
      expect(hasCollisionLayerError || hasResourceError).toBe(true);
    });

    it('should handle all properties together', () => {
      expectClean(`[gd_scene format=3]

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
`);
    });

    it('should handle node with no properties', () => {
      const diagnostics = lint(scene(node('StaticBody2D')));
      // Should only have warning about missing CollisionShape2D
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]!.ruleName).toBe('staticbody2d-needs-collision-shape');
    });

    it('should handle scientific notation in velocities', () => {
      expectNoErrors(
        scene(node('StaticBody2D', { constant_linear_velocity: 'Vector2(1e-5, 2.5e3)' }), collisionShape2d)
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(
        scene(node('StaticBody2D', { collision_layer: 1048575, collision_mask: 1048575 }), collisionShape2d)
      );
    });

    it('should handle whitespace in Vector2', () => {
      expectNoErrors(
        scene(
          node('StaticBody2D', { constant_linear_velocity: 'Vector2(  10.5  ,  -20.3  )' }),
          collisionShape2d
        )
      );
    });
  });
});
