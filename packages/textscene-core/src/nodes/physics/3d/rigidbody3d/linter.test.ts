/**
 * Tests for RigidBody3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  collisionShape3d,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('RigidBody3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid RigidBody3D properties', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="physics_mat_1"]

[node name="ValidRigidBody" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("physics_mat_1")
gravity_scale = 1.0
center_of_mass_mode = 0
center_of_mass = Vector3(0, 0, 0)
inertia = Vector3(0, 0, 0)
linear_damp_mode = 0
linear_damp = 0.5
angular_damp_mode = 0
angular_damp = 0.5
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
lock_rotation = false
freeze_mode = 0
freeze = false
continuous_cd = false
contact_monitor = true
max_contacts_reported = 10
can_sleep = true
sleeping = false
disable_mode = 0
custom_integrator = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
    });

    runPropertyValidation({ nodeType: 'RigidBody3D', acceptChild: collisionShape3d }, [
      {
        prop: 'mass',
        valid: [1.0],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -1.0, contains: ['greater than 0'] },
          { value: '"heavy"' },
        ],
      },
      {
        prop: 'gravity_scale',
        valid: [0.0, 1.0, 2.0, -1.0],
        invalid: [{ value: '"normal"' }],
      },
      {
        prop: 'center_of_mass_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }],
      },
      {
        prop: 'center_of_mass',
        valid: ['Vector3(0.5, -0.2, 0.1)'],
        invalid: [{ value: 'Vector3(1, 2)', contains: ['Vector3 with 3 numbers'] }],
      },
      {
        prop: 'inertia',
        valid: ['Vector3(1.0, 1.0, 1.0)', 'Vector3(0, 0, 0)'],
        invalid: [{ value: 'Vector3(1, -1, 1)', contains: ['>= 0'] }, { value: 'Vector3(1)' }],
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
      {
        prop: 'collision_priority',
        valid: [0.0, 0.5, 1.0, -1.0, 100.5],
        invalid: [{ value: '"high"' }],
      },
      {
        prop: 'lock_rotation',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'freeze_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }],
      },
      { prop: 'freeze', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'continuous_cd', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'contact_monitor', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'can_sleep', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'sleeping', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'custom_integrator', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      {
        prop: 'max_contacts_reported',
        valid: [1, 10, 100],
        with: { contact_monitor: true },
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -5, contains: ['greater than 0'] },
        ],
      },
      {
        prop: 'disable_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }],
      },
      {
        // Valid values include 0, which legitimately warns (zero collision layer).
        prop: 'collision_layer',
        acceptMode: 'no-error',
        valid: [0, 1, 100, 1048575],
        invalid: [
          { value: -1, contains: ['between 0 and 1048575'] },
          { value: 2000000, contains: ['between 0 and 1048575'] },
        ],
      },
      {
        // Valid values include 0, which legitimately warns (zero collision mask).
        prop: 'collision_mask',
        acceptMode: 'no-error',
        valid: [0, 1, 255, 1048575],
        invalid: [{ value: -5, contains: ['between 0 and 1048575'] }],
      },
    ]);

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
      });

      it('should reject invalid physics_material_override format', () => {
        expectDiagnostic(
          scene(node('RigidBody3D', { mass: 1.0, physics_material_override: '"invalid_format"' })),
          { prop: 'physics_material_override', contains: ['resource reference'] }
        );
      });
    });

  });

  describe('Semantic Validation (Mass and Damping)', () => {
    it('should warn about very low mass', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 0.001 }), collisionShape3d), {
        ruleName: 'rigidbody3d-mass-too-low',
        severity: 'warning',
        contains: ['very low mass'],
      });
    });

    it('should warn about very high mass', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 50000 }), collisionShape3d), {
        ruleName: 'rigidbody3d-mass-too-high',
        severity: 'warning',
        contains: ['very high mass'],
      });
    });

    it('should warn about excessive linear_damp', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 1.0, linear_damp: 20.0 }), collisionShape3d), {
        ruleName: 'rigidbody3d-excessive-linear-damp',
        severity: 'warning',
        contains: ['stop too quickly'],
      });
    });

    it('should warn about excessive angular_damp', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 1.0, angular_damp: 15.0 }), collisionShape3d), {
        ruleName: 'rigidbody3d-excessive-angular-damp',
        severity: 'warning',
        contains: ['stop rotating too quickly'],
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      expectDiagnostic(
        scene(node('RigidBody3D', { mass: 1.0, physics_material_override: 'SubResource("nonexistent")' })),
        {
          ruleName: 'valid-rigidbody3d-resources',
          severity: 'error',
          nodeType: 'RigidBody3D',
          contains: ['Physics material resource not found'],
        }
      );
    });

    it('should pass when physics_material_override resource exists', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
    });

    it('should accept ExtResource references', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="RigidBody3D"]
mass = 1.0
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
    });
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when RigidBody3D has no CollisionShape3D children', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 1.0 })), {
        ruleName: 'rigidbody3d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'RigidBody3D',
        contains: ['no CollisionShape3D children'],
      });
    });

    it('should pass when RigidBody3D has CollisionShape3D child', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0 }), collisionShape3d));
    });

    it('should pass when RigidBody3D has nested CollisionShape3D', () => {
      expectClean(
        scene(
          node('RigidBody3D', { mass: 1.0 }),
          node('Node3D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape3D', {}, { parent: 'Container' })
        )
      );
    });

    it('should pass when RigidBody3D has multiple CollisionShape3D children', () => {
      expectClean(
        scene(
          node('RigidBody3D', { mass: 1.0 }),
          node('CollisionShape3D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape3D', {}, { name: 'Shape2', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Contact Monitor)', () => {
    it('should warn when max_contacts_reported set but contact_monitor=false', () => {
      expectDiagnostic(
        scene(node('RigidBody3D', { mass: 1.0, contact_monitor: false, max_contacts_reported: 10 }), collisionShape3d),
        {
          ruleName: 'rigidbody3d-max-contacts-without-monitor',
          severity: 'warning',
          nodeType: 'RigidBody3D',
          contains: ['contact_monitor is not enabled'],
        }
      );
    });

    it('should warn when max_contacts_reported set without explicit contact_monitor', () => {
      expectDiagnostic(
        scene(node('RigidBody3D', { mass: 1.0, max_contacts_reported: 10 }), collisionShape3d),
        { ruleName: 'rigidbody3d-max-contacts-without-monitor' }
      );
    });

    it('should not warn when max_contacts_reported and contact_monitor=true', () => {
      expectClean(
        scene(node('RigidBody3D', { mass: 1.0, contact_monitor: true, max_contacts_reported: 10 }), collisionShape3d)
      );
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 1.0, collision_layer: 0 }), collisionShape3d), {
        ruleName: 'rigidbody3d-zero-collision-layer',
        severity: 'warning',
        nodeType: 'RigidBody3D',
        contains: ['collision_layer set to 0'],
      });
    });

    it('should not warn when collision_layer is non-zero', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0, collision_layer: 1 }), collisionShape3d));
    });

    it('should warn when collision_mask is 0', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 1.0, collision_mask: 0 }), collisionShape3d), {
        ruleName: 'rigidbody3d-zero-collision-mask',
        severity: 'warning',
        nodeType: 'RigidBody3D',
        contains: ['collision_mask set to 0'],
      });
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0, collision_mask: 1 }), collisionShape3d));
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('RigidBody3D', {
            mass: 0,
            disable_mode: 10,
            collision_layer: -5,
            physics_material_override: 'SubResource("nonexistent")',
            linear_damp: -1.0,
          })
        )
      );
      // Should have multiple errors: mass, disable_mode, collision_layer, physics_material_override, linear_damp
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ComplexRigidBody" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("mat_1")
gravity_scale = 1.0
center_of_mass_mode = 0
center_of_mass = Vector3(0, 0, 0)
inertia = Vector3(0, 0, 0)
linear_damp_mode = 0
linear_damp = 0.5
angular_damp_mode = 0
angular_damp = 0.5
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
lock_rotation = false
freeze_mode = 0
freeze = false
continuous_cd = false
contact_monitor = true
max_contacts_reported = 10
can_sleep = true
sleeping = false
disable_mode = 0
custom_integrator = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`);
    });

    it('should handle node with minimal properties', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0 }), collisionShape3d));
    });

    it('should handle scientific notation in numeric properties', () => {
      expectClean(
        scene(
          node('RigidBody3D', {
            mass: '1.5e2',
            gravity_scale: '2.5e-1',
            inertia: 'Vector3(1e3, 2.5e2, 3.14e1)',
          }),
          collisionShape3d
        )
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(
        scene(node('RigidBody3D', { mass: 1.0, collision_layer: 1048575, collision_mask: 1048575 }), collisionShape3d)
      );
    });

    it('should handle combination of warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('RigidBody3D', {
            mass: 0.001,
            linear_damp: 20.0,
            collision_layer: 0,
            max_contacts_reported: 10,
          }),
          collisionShape3d
        )
      );
      // Should have warnings: low mass, excessive damping, zero collision_layer, max_contacts without monitor
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
