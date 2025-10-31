/**
 * Tests for RigidBody2D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('RigidBody2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid RigidBody2D properties', () => {
      const content = `[gd_scene format=3]

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
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('mass validation', () => {
      it('should accept valid positive mass', () => {
        const content = `[gd_scene format=3]

[node name="ValidMass" type="RigidBody2D"]
mass = 1.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero mass', () => {
        const content = `[gd_scene format=3]

[node name="ZeroMass" type="RigidBody2D"]
mass = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('mass'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });

      it('should reject negative mass', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMass" type="RigidBody2D"]
mass = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('mass'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });

      it('should reject non-numeric mass', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMass" type="RigidBody2D"]
mass = "heavy"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('mass'));
        expect(error).toBeDefined();
      });

      it('should warn about very low mass', () => {
        const content = `[gd_scene format=3]

[node name="LowMass" type="RigidBody2D"]
mass = 0.001

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-mass-too-low');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('very low mass');
      });

      it('should warn about very high mass', () => {
        const content = `[gd_scene format=3]

[node name="HighMass" type="RigidBody2D"]
mass = 50000

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-mass-too-high');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('very high mass');
      });
    });

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMaterial" type="RigidBody2D"]
mass = 1.0
physics_material_override = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('physics_material_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('resource reference');
      });
    });

    describe('gravity_scale validation', () => {
      it('should accept valid gravity_scale values', () => {
        const validValues = [0.0, 1.0, 2.0, -1.0];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidGravity${value}" type="RigidBody2D"]
mass = 1.0
gravity_scale = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric gravity_scale', () => {
        const content = `[gd_scene format=3]

[node name="InvalidGravity" type="RigidBody2D"]
mass = 1.0
gravity_scale = "normal"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_scale'));
        expect(error).toBeDefined();
      });
    });

    describe('center_of_mass_mode validation', () => {
      it('should accept valid center_of_mass_mode values', () => {
        const validValues = [0, 1]; // AUTO, CUSTOM

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidCOMMode${value}" type="RigidBody2D"]
mass = 1.0
center_of_mass_mode = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid center_of_mass_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCOMMode" type="RigidBody2D"]
mass = 1.0
center_of_mass_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('center_of_mass_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-1');
      });
    });

    describe('center_of_mass validation', () => {
      it('should accept valid center_of_mass format', () => {
        const content = `[gd_scene format=3]

[node name="ValidCOM" type="RigidBody2D"]
mass = 1.0
center_of_mass = Vector2(0.5, -0.2)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid center_of_mass format (Vector3)', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCOM" type="RigidBody2D"]
mass = 1.0
center_of_mass = Vector3(1, 2, 3)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('center_of_mass'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector2 with 2 numbers');
      });

      it('should reject invalid center_of_mass format (single value)', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCOM" type="RigidBody2D"]
mass = 1.0
center_of_mass = Vector2(1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('center_of_mass'));
        expect(error).toBeDefined();
      });
    });

    describe('inertia validation', () => {
      it('should accept valid inertia values (scalar float)', () => {
        const content = `[gd_scene format=3]

[node name="ValidInertia" type="RigidBody2D"]
mass = 1.0
inertia = 1.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero inertia (auto-compute)', () => {
        const content = `[gd_scene format=3]

[node name="AutoInertia" type="RigidBody2D"]
mass = 1.0
inertia = 0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative inertia', () => {
        const content = `[gd_scene format=3]

[node name="NegativeInertia" type="RigidBody2D"]
mass = 1.0
inertia = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('inertia'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('>= 0');
      });

      it('should reject Vector3 inertia (2D uses scalar)', () => {
        const content = `[gd_scene format=3]

[node name="VectorInertia" type="RigidBody2D"]
mass = 1.0
inertia = Vector3(1, 1, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('inertia'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('scalar');
      });
    });

    describe('linear_damp_mode validation', () => {
      it('should accept valid linear_damp_mode values', () => {
        const validValues = [0, 1]; // COMBINE, REPLACE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLinearMode${value}" type="RigidBody2D"]
mass = 1.0
linear_damp_mode = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid linear_damp_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidLinearMode" type="RigidBody2D"]
mass = 1.0
linear_damp_mode = 3
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('linear_damp_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-1');
      });
    });

    describe('linear_damp validation', () => {
      it('should accept valid linear_damp values', () => {
        const validValues = [0.0, 0.5, 5.0];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLinearDamp${value}" type="RigidBody2D"]
mass = 1.0
linear_damp = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative linear_damp', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLinearDamp" type="RigidBody2D"]
mass = 1.0
linear_damp = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('linear_damp'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('>= 0');
      });

      it('should warn about excessive linear_damp', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveLinearDamp" type="RigidBody2D"]
mass = 1.0
linear_damp = 20.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-excessive-linear-damp');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('stop too quickly');
      });
    });

    describe('angular_damp_mode validation', () => {
      it('should accept valid angular_damp_mode values', () => {
        const validValues = [0, 1]; // COMBINE, REPLACE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidAngularMode${value}" type="RigidBody2D"]
mass = 1.0
angular_damp_mode = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid angular_damp_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAngularMode" type="RigidBody2D"]
mass = 1.0
angular_damp_mode = 2
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('angular_damp_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-1');
      });
    });

    describe('angular_damp validation', () => {
      it('should accept valid angular_damp values', () => {
        const validValues = [0.0, 0.5, 5.0];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidAngularDamp${value}" type="RigidBody2D"]
mass = 1.0
angular_damp = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative angular_damp', () => {
        const content = `[gd_scene format=3]

[node name="NegativeAngularDamp" type="RigidBody2D"]
mass = 1.0
angular_damp = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('angular_damp'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('>= 0');
      });

      it('should warn about excessive angular_damp', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveAngularDamp" type="RigidBody2D"]
mass = 1.0
angular_damp = 15.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-excessive-angular-damp');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('stop rotating too quickly');
      });
    });

    describe('collision_layer validation', () => {
      it('should accept valid collision_layer values', () => {
        const validValues = [0, 1, 100, 1048575];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLayer${value}" type="RigidBody2D"]
mass = 1.0
collision_layer = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warning for 0 layer, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject negative collision_layer', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLayer" type="RigidBody2D"]
mass = 1.0
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

[node name="ExcessiveLayer" type="RigidBody2D"]
mass = 1.0
collision_layer = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_layer'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });
    });

    describe('collision_mask validation', () => {
      it('should accept valid collision_mask values', () => {
        const validValues = [0, 1, 255, 1048575];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMask${value}" type="RigidBody2D"]
mass = 1.0
collision_mask = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warning for 0 mask, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject negative collision_mask', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMask" type="RigidBody2D"]
mass = 1.0
collision_mask = -5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_mask'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });
    });

    describe('boolean properties validation', () => {
      const booleanProps = ['lock_rotation', 'freeze', 'contact_monitor'];

      for (const prop of booleanProps) {
        it(`should accept true value for ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="ValidBool" type="RigidBody2D"]
mass = 1.0
${prop} = true

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        });

        it(`should accept false value for ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="ValidBool" type="RigidBody2D"]
mass = 1.0
${prop} = false

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        });

        it(`should reject non-boolean ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="InvalidBool" type="RigidBody2D"]
mass = 1.0
${prop} = 1
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics.length).toBeGreaterThan(0);
          const error = diagnostics.find(d => d.message.includes(prop));
          expect(error).toBeDefined();
          expect(error?.message).toContain('boolean');
        });
      }
    });

    describe('max_contacts_reported validation', () => {
      it('should accept valid max_contacts_reported values', () => {
        const validValues = [1, 10, 100];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidContacts${value}" type="RigidBody2D"]
mass = 1.0
contact_monitor = true
max_contacts_reported = ${value}

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject zero max_contacts_reported', () => {
        const content = `[gd_scene format=3]

[node name="ZeroContacts" type="RigidBody2D"]
mass = 1.0
max_contacts_reported = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('max_contacts_reported'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });

      it('should reject negative max_contacts_reported', () => {
        const content = `[gd_scene format=3]

[node name="NegativeContacts" type="RigidBody2D"]
mass = 1.0
max_contacts_reported = -5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('max_contacts_reported'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMaterial" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const error = diagnostics.find(d => d.message.includes('Physics material resource not found'));
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        nodeType: 'RigidBody2D',
        ruleName: 'valid-rigidbody2d-resources',
      });
    });

    it('should pass when physics_material_override resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody2D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept ExtResource references', () => {
      const content = `[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="RigidBody2D"]
mass = 1.0
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (CollisionShape2D Children)', () => {
    it('should warn when RigidBody2D has no CollisionShape2D children', () => {
      const content = `[gd_scene format=3]

[node name="NoCollisionShape" type="RigidBody2D"]
mass = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-needs-collision-shape');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody2D',
      });
      expect(warning?.message).toContain('no CollisionShape2D children');
    });

    it('should pass when RigidBody2D has CollisionShape2D child', () => {
      const content = `[gd_scene format=3]

[node name="WithCollisionShape" type="RigidBody2D"]
mass = 1.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when RigidBody2D has nested CollisionShape2D', () => {
      const content = `[gd_scene format=3]

[node name="WithNestedShape" type="RigidBody2D"]
mass = 1.0

[node name="Container" type="Node2D" parent="."]

[node name="CollisionShape2D" type="CollisionShape2D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when RigidBody2D has multiple CollisionShape2D children', () => {
      const content = `[gd_scene format=3]

[node name="MultipleShapes" type="RigidBody2D"]
mass = 1.0

[node name="Shape1" type="CollisionShape2D" parent="."]

[node name="Shape2" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Contact Monitor)', () => {
    it('should warn when max_contacts_reported set but contact_monitor=false', () => {
      const content = `[gd_scene format=3]

[node name="ContactsWithoutMonitor" type="RigidBody2D"]
mass = 1.0
contact_monitor = false
max_contacts_reported = 10

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-max-contacts-without-monitor');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody2D',
      });
      expect(warning?.message).toContain('contact_monitor is not enabled');
    });

    it('should warn when max_contacts_reported set without explicit contact_monitor', () => {
      const content = `[gd_scene format=3]

[node name="ContactsNoMonitor" type="RigidBody2D"]
mass = 1.0
max_contacts_reported = 10

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-max-contacts-without-monitor');
      expect(warning).toBeDefined();
    });

    it('should not warn when max_contacts_reported and contact_monitor=true', () => {
      const content = `[gd_scene format=3]

[node name="ValidContacts" type="RigidBody2D"]
mass = 1.0
contact_monitor = true
max_contacts_reported = 10

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoLayer" type="RigidBody2D"]
mass = 1.0
collision_layer = 0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-zero-collision-layer');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody2D',
      });
      expect(warning?.message).toContain('collision_layer set to 0');
    });

    it('should not warn when collision_layer is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithLayer" type="RigidBody2D"]
mass = 1.0
collision_layer = 1

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when collision_mask is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoMask" type="RigidBody2D"]
mass = 1.0
collision_mask = 0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody2d-zero-collision-mask');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody2D',
      });
      expect(warning?.message).toContain('collision_mask set to 0');
    });

    it('should not warn when collision_mask is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithMask" type="RigidBody2D"]
mass = 1.0
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

[node name="MultipleErrors" type="RigidBody2D"]
mass = 0
collision_layer = -5
physics_material_override = SubResource("nonexistent")
linear_damp = -1.0
`;

      const diagnostics = linter.lint(content);
      // Should have multiple errors: mass, collision_layer, physics_material_override, linear_damp
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

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
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with minimal properties', () => {
      const content = `[gd_scene format=3]

[node name="MinimalRigidBody" type="RigidBody2D"]
mass = 1.0

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle scientific notation in numeric properties', () => {
      const content = `[gd_scene format=3]

[node name="ScientificNotation" type="RigidBody2D"]
mass = 1.5e2
gravity_scale = 2.5e-1
inertia = 1e3
center_of_mass = Vector2(1e1, 2.5e-2)

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle bitmask boundaries', () => {
      const content = `[gd_scene format=3]

[node name="BitmaskBoundary" type="RigidBody2D"]
mass = 1.0
collision_layer = 1048575
collision_mask = 1048575

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle combination of warnings and errors', () => {
      const content = `[gd_scene format=3]

[node name="WarningsAndErrors" type="RigidBody2D"]
mass = 0.001
linear_damp = 20.0
collision_layer = 0
max_contacts_reported = 10

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have warnings: low mass, excessive damping, zero collision_layer, max_contacts without monitor
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
