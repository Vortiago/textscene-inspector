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
        // rigid_body_2d.cpp:425, ERR_FAIL_COND(p_linear_damp < -1): -1 is the
        // "use the project default" sentinel in 2D, and hint :763 starts there.
        prop: 'linear_damp',
        valid: [0.0, 0.5, 5.0, 20.0, -1.0],
        invalid: [{ value: -1.5, contains: ['>= -1'] }],
      },
      {
        prop: 'angular_damp_mode',
        valid: [0, 1],
        invalid: [{ value: 2, contains: ['0-1'] }],
      },
      {
        // rigid_body_2d.cpp:435, ERR_FAIL_COND(p_angular_damp < -1); hint :767
        // starts at -1 too.
        prop: 'angular_damp',
        valid: [0.0, 0.5, 5.0, 15.0, -0.5, -1.0],
        invalid: [{ value: -1.5, contains: ['>= -1'] }],
      },
      { prop: 'lock_rotation', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'freeze', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'contact_monitor', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      {
        // rigid_body_2d.cpp:501, ERR_FAIL_INDEX_MSG(p_amount,
        // MAX_CONTACTS_REPORTED_2D_MAX=4096): the engine enforces [0, 4095].
        prop: 'max_contacts_reported',
        valid: [0, 1, 10, 100, 4095],
        with: { contact_monitor: true },
        invalid: [
          { value: -5, contains: ['between 0 and 4095'] },
          { value: 4096, contains: ['between 0 and 4095'] },
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
          valid: [0, 1, 100, 1048575, 2000000, 2147483648, 4294967295],
          invalid: [
{ value: -1, contains: ['must be between 0 and 4294967295'] },
          ],
        },
      {
        prop: 'collision_mask',
        valid: [0, 1, 255, 1048575, 2147483648, 4294967295],
        invalid: [{ value: -5, contains: ['between 0 and 4294967295'] }],
      },
    ]);
  });

  describe('Semantic Validation (Mass and Damping Warnings)', () => {
    // rigid_body_2d.cpp:742 hints "0.001,1000,0.001,or_greater": the high end is
    // open, so only the gap between the setter's ERR_FAIL (mass <= 0, :318) and
    // the hint's 0.001 is advisory.
    it('should warn about mass below the hint', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: '0.0005' }), collisionShape2d), {
        ruleName: 'rigidbody2d-mass-too-low',
        severity: 'warning',
        contains: ['0.0005', '0.001'],
      });
    });

    it.each(['0.001', 1.0, 50000])('says nothing about mass %s', (mass) => {
      expectClean(scene(node('RigidBody2D', { mass }), collisionShape2d));
    });

    // rigid_body_2d.cpp:763/:767 both hint "-1,100,0.001,or_greater", so the high
    // end is open and a large damp is in band.
    it.each(['20.0', '15.0', '500.0'])('says nothing about damping %s', (damp) => {
      expectClean(
        scene(node('RigidBody2D', { mass: 1.0, linear_damp: damp, angular_damp: damp }), collisionShape2d)
      );
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
    it('should warn when RigidBody2D has no CollisionShape2D or CollisionPolygon2D children', () => {
      expectDiagnostic(scene(node('RigidBody2D', { mass: 1.0 })), {
        ruleName: 'rigidbody2d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'RigidBody2D',
        contains: ['no CollisionShape2D or CollisionPolygon2D children'],
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
      // One strict-parser error, mass <= 0 (rigid_body_2d.cpp:318). linear_damp
      // = -1 is legal in 2D (:425 rejects only < -1), and collision_layer = -5
      // is now a warning: its 32-bit width is the inspector's checkbox grid,
      // not an engine bound.
      const errors = diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toHaveLength(2);
      expect(
        diagnostics.find((d) => d.message.includes('collision_layer'))?.severity
      ).toBe('warning');
      // The third is the missing physics material. It was invisible until the
      // strict parser stopped withholding the scene: the mass error suppressed
      // the whole rule phase, so a broken resource reference went unreported
      // because an unrelated property had a bad value.
      expect(errors.some((d) => d.ruleName === 'valid-rigidbody2d-resources')).toBe(true);
      expect(diagnostics.some(d => d.message.includes('linear_damp'))).toBe(false);
      // The body's semantic warnings arrive alongside those errors. They used to
      // be suppressed: a validator error withheld the scene and the rule phase
      // never ran, which is what made this body look like an errors-only case.
      expect(diagnostics.some((d) => d.ruleName === 'rigidbody2d-needs-collision-shape')).toBe(
        true
      );
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
      // Warnings: zero collision_layer and max_contacts without monitor. mass
      // 0.001 sits exactly on the hint's bottom (:742) and linear_damp 20 is under
      // its open top (:763), so neither of those contributes any more.
      expect(diagnostics.map(d => d.ruleName).sort()).toEqual([
        'rigidbody2d-max-contacts-without-monitor',
        'rigidbody2d-zero-collision-layer',
      ]);
      expect(diagnostics.every(d => d.severity === 'warning')).toBe(true);
    });
  });
});
