/**
 * Tests for RigidBody2D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
  collisionShape2d,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('RigidBody2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid RigidBody2D properties', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="physics_mat_1"]

[node name="ValidRigidBody" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("physics_mat_1")
gravity_scale = 1.0
center_of_mass_mode = 0
center_of_mass = Vector2(0, 0)
inertia = 1.0
linear_damp_mode = 0
linear_damp = 0.5
angular_damp_mode = 0
angular_damp = 0.5
collision_layer = 1
collision_mask = 1
lock_rotation = false
freeze = false
contact_monitor = true
max_contacts_reported = 10

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
    });

    runPropertyValidation({ nodeType: 'RigidBody2D', acceptChild: collisionShape2d }, [
      {
        prop: 'mass',
        valid: [1.0],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -1.0, contains: ['greater than 0'] },
          { value: '"heavy"' },
        ],
      },
      { prop: 'gravity_scale', valid: [0.0, 1.0, 2.0, -1.0], invalid: [{ value: '"normal"' }] },
      {
        prop: 'center_of_mass_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }],
      },
      {
        prop: 'center_of_mass',
        valid: ['Vector2(0.5, -0.2)'],
        invalid: [
          { value: 'Vector3(1, 2, 3)', contains: ['Vector2 with 2 numbers'] },
          { value: 'Vector2(1)' },
        ],
      },
      {
        prop: 'inertia',
        valid: [1.0, 0],
        invalid: [
          { value: -1.0, contains: ['>= 0'] },
          { value: 'Vector3(1, 1, 1)', contains: ['scalar'] },
        ],
      },
      {
        prop: 'linear_damp_mode',
        valid: [0, 1],
        invalid: [{ value: 3, contains: ['0-1'] }],
      },
      {
        prop: 'linear_damp',
        valid: [0.0, 0.5, 5.0],
        invalid: [{ value: -1.0, contains: ['>= 0'] }],
      },
      {
        prop: 'angular_damp_mode',
        valid: [0, 1],
        invalid: [{ value: 2, contains: ['0-1'] }],
      },
      {
        prop: 'angular_damp',
        valid: [0.0, 0.5, 5.0],
        invalid: [{ value: -0.5, contains: ['>= 0'] }],
      },
      { prop: 'lock_rotation', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'freeze', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'contact_monitor', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      {
        prop: 'max_contacts_reported',
        valid: [1, 10, 100],
        with: { contact_monitor: true },
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -5, contains: ['greater than 0'] },
        ],
      },
    ]);

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
      });

      it('should reject invalid physics_material_override format', () => {
        expectDiagnostic(
          scene(node('RigidBody2D', { mass: 1.0, physics_material_override: '"invalid_format"' })),
          { prop: 'physics_material_override', contains: ['resource reference'] }
        );
      });
    });

    // collision_layer/mask accept 0 (which legitimately warns), so use 'no-error' mode.
    runPropertyValidation({ nodeType: 'RigidBody2D', acceptChild: collisionShape2d, acceptMode: 'no-error' }, [
      {
        prop: 'collision_layer',
        valid: [0, 1, 100, 1048575],
        invalid: [
          { value: -1, contains: ['between 0 and 1048575'] },
          { value: 2000000, contains: ['between 0 and 1048575'] },
        ],
      },
      {
        prop: 'collision_mask',
        valid: [0, 1, 255, 1048575],
        invalid: [{ value: -5, contains: ['between 0 and 1048575'] }],
      },
    ]);
  });

  describe('Semantic Validation (Mass and Damping Warnings)', () => {
    it('should warn about very low mass', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: '0.001' }), collisionShape2d), {
        ruleName: 'rigidbody2d-mass-too-low',
        severity: 'warning',
        contains: ['very low mass'],
      });
    });

    it('should warn about very high mass', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 50000 }), collisionShape2d), {
        ruleName: 'rigidbody2d-mass-too-high',
        severity: 'warning',
        contains: ['very high mass'],
      });
    });

    it('should warn about excessive linear_damp', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 1.0, linear_damp: '20.0' }), collisionShape2d), {
        ruleName: 'rigidbody2d-excessive-linear-damp',
        severity: 'warning',
        contains: ['stop too quickly'],
      });
    });

    it('should warn about excessive angular_damp', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 1.0, angular_damp: '15.0' }), collisionShape2d), {
        ruleName: 'rigidbody2d-excessive-angular-damp',
        severity: 'warning',
        contains: ['stop rotating too quickly'],
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      expectDiagnostic(
        scene(node('RigidBody2D', { mass: 1.0, physics_material_override: 'SubResource("nonexistent")' })),
        {
          ruleName: 'valid-rigidbody2d-resources',
          severity: 'error',
          nodeType: 'RigidBody2D',
          contains: ['Physics material resource not found'],
        }
      );
    });

    it('should pass when physics_material_override resource exists', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
    });

    it('should accept ExtResource references', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="RigidBody2D"]
mass = 1.0
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
    });
  });

  describe('Semantic Validation (CollisionShape2D Children)', () => {
    it('should warn when RigidBody2D has no CollisionShape2D children', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 1.0 })), {
        ruleName: 'rigidbody2d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'RigidBody2D',
        contains: ['no CollisionShape2D children'],
      });
    });

    it('should pass when RigidBody2D has CollisionShape2D child', () => {
      expectClean(scene(node('RigidBody2D', { mass: 1.0 }), collisionShape2d));
    });

    it('should pass when RigidBody2D has nested CollisionShape2D', () => {
      expectClean(
        scene(
          node('RigidBody2D', { mass: 1.0 }),
          node('Node2D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape2D', {}, { parent: 'Container' })
        )
      );
    });

    it('should pass when RigidBody2D has multiple CollisionShape2D children', () => {
      expectClean(
        scene(
          node('RigidBody2D', { mass: 1.0 }),
          node('CollisionShape2D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape2D', {}, { name: 'Shape2', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Contact Monitor)', () => {
    it('should warn when max_contacts_reported set but contact_monitor=false', () => {
      expectDiagnostic(
        scene(node('RigidBody2D', { mass: 1.0, contact_monitor: false, max_contacts_reported: 10 }), collisionShape2d),
        {
          ruleName: 'rigidbody2d-max-contacts-without-monitor',
          severity: 'warning',
          nodeType: 'RigidBody2D',
          contains: ['contact_monitor is not enabled'],
        }
      );
    });

    it('should warn when max_contacts_reported set without explicit contact_monitor', () => {
      expectDiagnostic(
        scene(node('RigidBody2D', { mass: 1.0, max_contacts_reported: 10 }), collisionShape2d),
        { ruleName: 'rigidbody2d-max-contacts-without-monitor' }
      );
    });

    it('should not warn when max_contacts_reported and contact_monitor=true', () => {
      expectClean(
        scene(node('RigidBody2D', { mass: 1.0, contact_monitor: true, max_contacts_reported: 10 }), collisionShape2d)
      );
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 1.0, collision_layer: 0 }), collisionShape2d), {
        ruleName: 'rigidbody2d-zero-collision-layer',
        severity: 'warning',
        nodeType: 'RigidBody2D',
        contains: ['collision_layer set to 0'],
      });
    });

    it('should not warn when collision_layer is non-zero', () => {
      expectClean(scene(node('RigidBody2D', { mass: 1.0, collision_layer: 1 }), collisionShape2d));
    });

    it('should warn when collision_mask is 0', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 1.0, collision_mask: 0 }), collisionShape2d), {
        ruleName: 'rigidbody2d-zero-collision-mask',
        severity: 'warning',
        nodeType: 'RigidBody2D',
        contains: ['collision_mask set to 0'],
      });
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectClean(scene(node('RigidBody2D', { mass: 1.0, collision_mask: 1 }), collisionShape2d));
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('RigidBody2D', {
            mass: 0,
            collision_layer: -5,
            physics_material_override: 'SubResource("nonexistent")',
            linear_damp: -1.0,
          })
        )
      );
      // Should have multiple errors: mass, collision_layer, physics_material_override, linear_damp
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ComplexRigidBody" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("mat_1")
gravity_scale = 1.0
center_of_mass_mode = 0
center_of_mass = Vector2(0, 0)
inertia = 1.0
linear_damp_mode = 0
linear_damp = 0.5
angular_damp_mode = 0
angular_damp = 0.5
collision_layer = 1
collision_mask = 1
lock_rotation = false
freeze = false
contact_monitor = true
max_contacts_reported = 10

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`);
    });

    it('should handle node with minimal properties', () => {
      expectClean(scene(node('RigidBody2D', { mass: 1.0 }), collisionShape2d));
    });

    it('should handle scientific notation in numeric properties', () => {
      expectClean(
        scene(
          node('RigidBody2D', {
            mass: '1.5e2',
            gravity_scale: '2.5e-1',
            inertia: '1e3',
            center_of_mass: 'Vector2(1e1, 2.5e-2)',
          }),
          collisionShape2d
        )
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(
        scene(node('RigidBody2D', { mass: 1.0, collision_layer: 1048575, collision_mask: 1048575 }), collisionShape2d)
      );
    });

    it('should handle combination of warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('RigidBody2D', {
            mass: '0.001',
            linear_damp: '20.0',
            collision_layer: 0,
            max_contacts_reported: 10,
          }),
          collisionShape2d
        )
      );
      // Should have warnings: low mass, excessive damping, zero collision_layer, max_contacts without monitor
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
