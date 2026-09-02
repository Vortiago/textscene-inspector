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
import '../shared/linter';

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
        // rigid_body_3d.cpp:444, ERR_FAIL_COND(p_linear_damp < 0.0); hint :785
        // ends in `or_greater`, so a large damp is in band.
        prop: 'linear_damp',
        valid: [0.0, 0.5, 5.0, 20.0],
        invalid: [{ value: -1.0, contains: ['>= 0'] }],
      },
      {
        prop: 'angular_damp_mode',
        valid: [0, 1],
        invalid: [{ value: 2, contains: ['0-1'] }],
      },
      {
        // rigid_body_3d.cpp:454, ERR_FAIL_COND(p_angular_damp < 0.0); hint :789
        // ends in `or_greater`.
        prop: 'angular_damp',
        valid: [0.0, 0.5, 5.0, 15.0],
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
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        prop: 'freeze_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }],
      },
      { prop: 'freeze', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      { prop: 'continuous_cd', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      { prop: 'contact_monitor', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      { prop: 'can_sleep', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      { prop: 'sleeping', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      { prop: 'custom_integrator', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      {
        // rigid_body_3d.cpp:524, ERR_FAIL_INDEX_MSG(p_amount,
        // MAX_CONTACTS_REPORTED_3D_MAX=4096): fails on `< 0 || >= 4096`, so the
        // setter closes the hint's open ceiling one below the constant.
        prop: 'max_contacts_reported',
        valid: [0, 1, 10, 100, 4095],
        with: { contact_monitor: true },
        invalid: [
          { value: -5, contains: ['non-negative'] },
          { value: 4096, contains: ['less than 4096'] },
        ],
      },
      {
        // 2 is KEEP_ACTIVE — collision_object_2d.cpp:654 and its 3D twin bind
        // three constants. This table asserted 0-1 and encoded the bug.
        prop: 'disable_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
      {
        // Valid values include 0, which legitimately warns (zero collision layer).
        prop: 'collision_layer',
        acceptMode: 'no-error',
        valid: [0, 1, 100, 1048575, 2147483648, 4294967295],
        invalid: [
          { value: 4294967296, contains: ['cannot be stored in an integer slot'], severity: 'error' },
        ],
      },
      {
        // Valid values include 0, which legitimately warns (zero collision mask).
        prop: 'collision_mask',
        acceptMode: 'no-error',
        valid: [0, 1, 255, 1048575, 2147483648, 4294967295],
        invalid: [
          { value: 4294967296, contains: ['cannot be stored in an integer slot'], severity: 'error' },
        ],
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
    // rigid_body_3d.cpp:764 hints "0.001,1000,0.001,or_greater": the high end is
    // open, so only the gap between the setter's ERR_FAIL (mass <= 0, :334) and
    // the hint's 0.001 is advisory.
    // Reported by the validator's hinted floor rather than a rule: the two said
    // the same thing, and only the validator's is visible to the hint ledger.
    it('should warn about mass below the hint', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 0.0005 }), collisionShape3d), {
        prop: 'mass',
        severity: 'warning',
        contains: ['0.0005', '0.001'],
      });
    });

    it.each([0.001, 1.0, 50000])('says nothing about mass %s', (mass) => {
      expectClean(scene(node('RigidBody3D', { mass }), collisionShape3d));
    });

    // rigid_body_3d.cpp:785/:789 both hint "0,100,0.001,or_greater", so the high
    // end is open and a large damp is in band.
    it.each([20.0, 15.0, 500.0])('says nothing about damping %s', (damp) => {
      expectClean(
        scene(node('RigidBody3D', { mass: 1.0, linear_damp: damp, angular_damp: damp }), collisionShape3d)
      );
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      expectDiagnostic(
        scene(node('RigidBody3D', { mass: 1.0, physics_material_override: 'SubResource("nonexistent")' })),
        {
          ruleName: 'dangling-resource-reference',
          severity: 'error',
          nodeType: 'RigidBody3D',
          contains: ["'physics_material_override'"],
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
    it('should warn when RigidBody3D has no CollisionShape3D or CollisionPolygon3D children', () => {
      expectDiagnostic(scene(node('RigidBody3D', { mass: 1.0 })), {
        ruleName: 'collisionobject3d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'RigidBody3D',
        contains: ['no CollisionShape3D or CollisionPolygon3D children'],
      });
    });

    it('should pass when RigidBody3D has CollisionShape3D child', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0 }), collisionShape3d));
    });

    // A shape under an intervening node registers with nothing: `_notification`
    // attaches on `Object::cast_to<CollisionObject3D>(get_parent())`
    // (collision_shape_3d.cpp:83), so this body's `shapes` map stays empty and
    // Godot raises its own warning (collision_object_3d.cpp:739).
    it('warns when the only CollisionShape3D under RigidBody3D sits below an intervening node', () => {
      expectDiagnostic(
        scene(
          node('RigidBody3D', { mass: 1.0 }),
          node('Node3D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape3D', {}, { parent: 'Container' })
        ),
        { ruleName: 'collisionobject3d-needs-collision-shape', severity: 'warning' }
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
          contains: ['get_colliding_bodies() stays empty', 'contact COUNT still works'],
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
    it('should not warn when collision_layer is non-zero', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0, collision_layer: 1 }), collisionShape3d));
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0, collision_mask: 1 }), collisionShape3d));
    });
  });

  describe('Semantic Validation (Runtime-Overridden Scale)', () => {
    it('warns when an axis deviates from 1.0 by more than 0.05', () => {
      expectDiagnostic(
        scene(
          node(
            'RigidBody3D',
            { mass: 1.0, transform: 'Transform3D(1.2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' },
          ),
          collisionShape3d
        ),
        {
          ruleName: 'rigidbody3d-scale-overridden-at-runtime',
          severity: 'warning',
          nodeType: 'RigidBody3D',
          contains: ['overridden by the physics engine'],
        }
      );
    });

    // `get_scale()` is `SIGN(determinant()) * get_scale_abs()` (basis.cpp:321-322),
    // so a mirrored basis reads as (-1, -1, -1) and every axis fails
    // `abs(scale.axis - 1) > 0.05` (rigid_body_3d.cpp:666). Column MAGNITUDES are
    // (1, 1, 1) and say nothing, which is why the shared unsigned helper is right
    // for the pairwise non-uniform rules and wrong here.
    it('warns on a mirrored basis, whose signed scale is (-1, -1, -1)', () => {
      expectDiagnostic(
        scene(
          node('RigidBody3D', {
            mass: 1.0,
            transform: 'Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
          }),
          collisionShape3d
        ),
        { ruleName: 'rigidbody3d-scale-overridden-at-runtime', severity: 'warning' }
      );
    });

    it('warns on a UNIFORM scale too — not the pairwise x=y=z test collisionshape3d-non-uniform-scale runs', () => {
      expectDiagnostic(
        scene(
          node('RigidBody3D', { mass: 1.0, transform: 'Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)' }),
          collisionShape3d
        ),
        { ruleName: 'rigidbody3d-scale-overridden-at-runtime' }
      );
    });

    it('stays within tolerance comfortably under 0.05', () => {
      expectClean(
        scene(
          node(
            'RigidBody3D',
            { mass: 1.0, transform: 'Transform3D(1.04, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' },
          ),
          collisionShape3d
        )
      );
    });

    it('does not warn with no transform at all (identity)', () => {
      expectClean(scene(node('RigidBody3D', { mass: 1.0 }), collisionShape3d));
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

  });
});
