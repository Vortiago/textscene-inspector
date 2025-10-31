/**
 * Tests for RigidBody3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('RigidBody3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid RigidBody3D properties', () => {
      const content = `[gd_scene format=3]

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
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('mass validation', () => {
      it('should accept valid positive mass', () => {
        const content = `[gd_scene format=3]

[node name="ValidMass" type="RigidBody3D"]
mass = 1.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero mass', () => {
        const content = `[gd_scene format=3]

[node name="ZeroMass" type="RigidBody3D"]
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

[node name="NegativeMass" type="RigidBody3D"]
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

[node name="InvalidMass" type="RigidBody3D"]
mass = "heavy"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('mass'));
        expect(error).toBeDefined();
      });

      it('should warn about very low mass', () => {
        const content = `[gd_scene format=3]

[node name="LowMass" type="RigidBody3D"]
mass = 0.001

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-mass-too-low');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('very low mass');
      });

      it('should warn about very high mass', () => {
        const content = `[gd_scene format=3]

[node name="HighMass" type="RigidBody3D"]
mass = 50000

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-mass-too-high');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('very high mass');
      });
    });

    describe('physics_material_override validation', () => {
      it('should accept valid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid physics_material_override format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMaterial" type="RigidBody3D"]
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

[node name="ValidGravity${value}" type="RigidBody3D"]
mass = 1.0
gravity_scale = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric gravity_scale', () => {
        const content = `[gd_scene format=3]

[node name="InvalidGravity" type="RigidBody3D"]
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

[node name="ValidCOMMode${value}" type="RigidBody3D"]
mass = 1.0
center_of_mass_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid center_of_mass_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCOMMode" type="RigidBody3D"]
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

[node name="ValidCOM" type="RigidBody3D"]
mass = 1.0
center_of_mass = Vector3(0.5, -0.2, 0.1)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid center_of_mass format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCOM" type="RigidBody3D"]
mass = 1.0
center_of_mass = Vector3(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('center_of_mass'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector3 with 3 numbers');
      });
    });

    describe('inertia validation', () => {
      it('should accept valid inertia format', () => {
        const content = `[gd_scene format=3]

[node name="ValidInertia" type="RigidBody3D"]
mass = 1.0
inertia = Vector3(1.0, 1.0, 1.0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero inertia (auto-compute)', () => {
        const content = `[gd_scene format=3]

[node name="AutoInertia" type="RigidBody3D"]
mass = 1.0
inertia = Vector3(0, 0, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative inertia components', () => {
        const content = `[gd_scene format=3]

[node name="NegativeInertia" type="RigidBody3D"]
mass = 1.0
inertia = Vector3(1, -1, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('inertia'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('>= 0');
      });

      it('should reject invalid inertia format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidInertia" type="RigidBody3D"]
mass = 1.0
inertia = Vector3(1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('inertia'));
        expect(error).toBeDefined();
      });
    });

    describe('linear_damp_mode validation', () => {
      it('should accept valid linear_damp_mode values', () => {
        const validValues = [0, 1]; // COMBINE, REPLACE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLinearMode${value}" type="RigidBody3D"]
mass = 1.0
linear_damp_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid linear_damp_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidLinearMode" type="RigidBody3D"]
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

[node name="ValidLinearDamp${value}" type="RigidBody3D"]
mass = 1.0
linear_damp = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative linear_damp', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLinearDamp" type="RigidBody3D"]
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

[node name="ExcessiveLinearDamp" type="RigidBody3D"]
mass = 1.0
linear_damp = 20.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-excessive-linear-damp');
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

[node name="ValidAngularMode${value}" type="RigidBody3D"]
mass = 1.0
angular_damp_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid angular_damp_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAngularMode" type="RigidBody3D"]
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

[node name="ValidAngularDamp${value}" type="RigidBody3D"]
mass = 1.0
angular_damp = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative angular_damp', () => {
        const content = `[gd_scene format=3]

[node name="NegativeAngularDamp" type="RigidBody3D"]
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

[node name="ExcessiveAngularDamp" type="RigidBody3D"]
mass = 1.0
angular_damp = 15.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-excessive-angular-damp');
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

[node name="ValidLayer${value}" type="RigidBody3D"]
mass = 1.0
collision_layer = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warning for 0 layer, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject negative collision_layer', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLayer" type="RigidBody3D"]
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

[node name="ExcessiveLayer" type="RigidBody3D"]
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

[node name="ValidMask${value}" type="RigidBody3D"]
mass = 1.0
collision_mask = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warning for 0 mask, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject negative collision_mask', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMask" type="RigidBody3D"]
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

    describe('collision_priority validation', () => {
      it('should accept valid collision_priority values', () => {
        const validValues = [0.0, 0.5, 1.0, -1.0, 100.5];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidPriority${value}" type="RigidBody3D"]
mass = 1.0
collision_priority = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric collision_priority', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPriority" type="RigidBody3D"]
mass = 1.0
collision_priority = "high"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_priority'));
        expect(error).toBeDefined();
      });
    });

    describe('lock_rotation validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="LockedRotation" type="RigidBody3D"]
mass = 1.0
lock_rotation = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="UnlockedRotation" type="RigidBody3D"]
mass = 1.0
lock_rotation = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean lock_rotation', () => {
        const content = `[gd_scene format=3]

[node name="InvalidLockRotation" type="RigidBody3D"]
mass = 1.0
lock_rotation = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('lock_rotation'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });

    describe('freeze_mode validation', () => {
      it('should accept valid freeze_mode values', () => {
        const validValues = [0, 1]; // STATIC, KINEMATIC

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidFreezeMode${value}" type="RigidBody3D"]
mass = 1.0
freeze_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid freeze_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFreezeMode" type="RigidBody3D"]
mass = 1.0
freeze_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('freeze_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-1');
      });
    });

    describe('boolean properties validation', () => {
      const booleanProps = ['freeze', 'continuous_cd', 'contact_monitor', 'can_sleep', 'sleeping', 'custom_integrator'];

      for (const prop of booleanProps) {
        it(`should accept true value for ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="ValidBool" type="RigidBody3D"]
mass = 1.0
${prop} = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        });

        it(`should accept false value for ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="ValidBool" type="RigidBody3D"]
mass = 1.0
${prop} = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        });

        it(`should reject non-boolean ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="InvalidBool" type="RigidBody3D"]
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

[node name="ValidContacts${value}" type="RigidBody3D"]
mass = 1.0
contact_monitor = true
max_contacts_reported = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject zero max_contacts_reported', () => {
        const content = `[gd_scene format=3]

[node name="ZeroContacts" type="RigidBody3D"]
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

[node name="NegativeContacts" type="RigidBody3D"]
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

    describe('disable_mode validation', () => {
      it('should accept valid disable_mode values', () => {
        const validValues = [0, 1]; // REMOVE, KEEP_ACTIVE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMode${value}" type="RigidBody3D"]
mass = 1.0
disable_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid disable_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMode" type="RigidBody3D"]
mass = 1.0
disable_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('disable_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-1');
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing physics_material_override resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMaterial" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const error = diagnostics.find(d => d.message.includes('Physics material resource not found'));
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        nodeType: 'RigidBody3D',
        ruleName: 'valid-rigidbody3d-resources',
      });
    });

    it('should pass when physics_material_override resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="PhysicsMaterial" id="mat_1"]

[node name="ValidMaterial" type="RigidBody3D"]
mass = 1.0
physics_material_override = SubResource("mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept ExtResource references', () => {
      const content = `[gd_scene format=3]

[ext_resource type="PhysicsMaterial" path="res://materials/physics.tres" id="ext_mat_1"]

[node name="ExtResource" type="RigidBody3D"]
mass = 1.0
physics_material_override = ExtResource("ext_mat_1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when RigidBody3D has no CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="NoCollisionShape" type="RigidBody3D"]
mass = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-needs-collision-shape');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody3D',
      });
      expect(warning?.message).toContain('no CollisionShape3D children');
    });

    it('should pass when RigidBody3D has CollisionShape3D child', () => {
      const content = `[gd_scene format=3]

[node name="WithCollisionShape" type="RigidBody3D"]
mass = 1.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when RigidBody3D has nested CollisionShape3D', () => {
      const content = `[gd_scene format=3]

[node name="WithNestedShape" type="RigidBody3D"]
mass = 1.0

[node name="Container" type="Node3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when RigidBody3D has multiple CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="MultipleShapes" type="RigidBody3D"]
mass = 1.0

[node name="Shape1" type="CollisionShape3D" parent="."]

[node name="Shape2" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Contact Monitor)', () => {
    it('should warn when max_contacts_reported set but contact_monitor=false', () => {
      const content = `[gd_scene format=3]

[node name="ContactsWithoutMonitor" type="RigidBody3D"]
mass = 1.0
contact_monitor = false
max_contacts_reported = 10

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-max-contacts-without-monitor');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody3D',
      });
      expect(warning?.message).toContain('contact_monitor is not enabled');
    });

    it('should warn when max_contacts_reported set without explicit contact_monitor', () => {
      const content = `[gd_scene format=3]

[node name="ContactsNoMonitor" type="RigidBody3D"]
mass = 1.0
max_contacts_reported = 10

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-max-contacts-without-monitor');
      expect(warning).toBeDefined();
    });

    it('should not warn when max_contacts_reported and contact_monitor=true', () => {
      const content = `[gd_scene format=3]

[node name="ValidContacts" type="RigidBody3D"]
mass = 1.0
contact_monitor = true
max_contacts_reported = 10

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoLayer" type="RigidBody3D"]
mass = 1.0
collision_layer = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-zero-collision-layer');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody3D',
      });
      expect(warning?.message).toContain('collision_layer set to 0');
    });

    it('should not warn when collision_layer is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithLayer" type="RigidBody3D"]
mass = 1.0
collision_layer = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn when collision_mask is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoMask" type="RigidBody3D"]
mass = 1.0
collision_mask = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'rigidbody3d-zero-collision-mask');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'RigidBody3D',
      });
      expect(warning?.message).toContain('collision_mask set to 0');
    });

    it('should not warn when collision_mask is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithMask" type="RigidBody3D"]
mass = 1.0
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

[node name="MultipleErrors" type="RigidBody3D"]
mass = 0
disable_mode = 10
collision_layer = -5
physics_material_override = SubResource("nonexistent")
linear_damp = -1.0
`;

      const diagnostics = linter.lint(content);
      // Should have multiple errors: mass, disable_mode, collision_layer, physics_material_override, linear_damp
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

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
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with minimal properties', () => {
      const content = `[gd_scene format=3]

[node name="MinimalRigidBody" type="RigidBody3D"]
mass = 1.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle scientific notation in numeric properties', () => {
      const content = `[gd_scene format=3]

[node name="ScientificNotation" type="RigidBody3D"]
mass = 1.5e2
gravity_scale = 2.5e-1
inertia = Vector3(1e3, 2.5e2, 3.14e1)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle bitmask boundaries', () => {
      const content = `[gd_scene format=3]

[node name="BitmaskBoundary" type="RigidBody3D"]
mass = 1.0
collision_layer = 1048575
collision_mask = 1048575

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle combination of warnings and errors', () => {
      const content = `[gd_scene format=3]

[node name="WarningsAndErrors" type="RigidBody3D"]
mass = 0.001
linear_damp = 20.0
collision_layer = 0
max_contacts_reported = 10

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have warnings: low mass, excessive damping, zero collision_layer, max_contacts without monitor
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
