/**
 * Tests for Area3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('Area3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Area3D properties', () => {
      const content = `[gd_scene format=3]

[node name="ValidArea" type="Area3D"]
monitoring = true
monitorable = true
space_override = 0
gravity_space_override = 0
gravity_point = false
gravity_point_center = Vector3(0, 0, 0)
gravity_point_unit_distance = 1.0
gravity_direction = Vector3(0, -1, 0)
gravity = 9.8
linear_damp_space_override = 0
linear_damp = 0.0
angular_damp_space_override = 0
angular_damp = 0.0
priority = 0.0
audio_bus_override = false
audio_bus_name = "Master"
collision_layer = 1
collision_mask = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('monitoring validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="MonitoringTrue" type="Area3D"]
monitoring = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="MonitoringFalse" type="Area3D"]
monitoring = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean monitoring', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMonitoring" type="Area3D"]
monitoring = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('monitoring'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });

    describe('monitorable validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="MonitorableTrue" type="Area3D"]
monitorable = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="MonitorableFalse" type="Area3D"]
monitorable = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean monitorable', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMonitorable" type="Area3D"]
monitorable = "yes"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('monitorable'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });

    describe('space_override validation', () => {
      it('should accept all valid space_override values', () => {
        const validValues = [0, 1, 2, 3, 4]; // DISABLED to REPLACE_COMBINE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="SpaceOverride${value}" type="Area3D"]
space_override = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid space_override value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidOverride" type="Area3D"]
space_override = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('space_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-4');
        expect(error?.message).toContain('DISABLED');
      });

      it('should reject negative space_override', () => {
        const content = `[gd_scene format=3]

[node name="NegativeOverride" type="Area3D"]
space_override = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('space_override'));
        expect(error).toBeDefined();
      });
    });

    describe('gravity_space_override validation', () => {
      it('should accept all valid gravity_space_override values', () => {
        const validValues = [0, 1, 2, 3, 4];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="GravityOverride${value}" type="Area3D"]
gravity_space_override = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid gravity_space_override value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidGravityOverride" type="Area3D"]
gravity_space_override = 10
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_space_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-4');
      });
    });

    describe('gravity_point validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="PointGravityTrue" type="Area3D"]
gravity_point = true
gravity_point_unit_distance = 1.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="PointGravityFalse" type="Area3D"]
gravity_point = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean gravity_point', () => {
        const content = `[gd_scene format=3]

[node name="InvalidGravityPoint" type="Area3D"]
gravity_point = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_point'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });

    describe('gravity_point_center validation', () => {
      it('should accept valid gravity_point_center format', () => {
        const content = `[gd_scene format=3]

[node name="ValidCenter" type="Area3D"]
gravity_point_center = Vector3(1.5, 2.0, -3.5)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid gravity_point_center format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCenter" type="Area3D"]
gravity_point_center = Vector3(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_point_center'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector3 with 3 numbers');
      });

      it('should reject non-Vector3 gravity_point_center', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFormat" type="Area3D"]
gravity_point_center = 1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_point_center'));
        expect(error).toBeDefined();
      });
    });

    describe('gravity_point_unit_distance validation', () => {
      it('should accept valid positive distance', () => {
        const content = `[gd_scene format=3]

[node name="ValidDistance" type="Area3D"]
gravity_point_unit_distance = 10.5

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero distance', () => {
        const content = `[gd_scene format=3]

[node name="ZeroDistance" type="Area3D"]
gravity_point_unit_distance = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_point_unit_distance'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });

      it('should reject negative distance', () => {
        const content = `[gd_scene format=3]

[node name="NegativeDistance" type="Area3D"]
gravity_point_unit_distance = -5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_point_unit_distance'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });

      it('should reject non-numeric distance', () => {
        const content = `[gd_scene format=3]

[node name="InvalidDistance" type="Area3D"]
gravity_point_unit_distance = "far"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_point_unit_distance'));
        expect(error).toBeDefined();
      });
    });

    describe('gravity_direction validation', () => {
      it('should accept valid gravity_direction format', () => {
        const content = `[gd_scene format=3]

[node name="ValidDirection" type="Area3D"]
gravity_direction = Vector3(0, -1, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid gravity_direction format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidDirection" type="Area3D"]
gravity_direction = Vector3(0, -1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity_direction'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector3 with 3 numbers');
      });
    });

    describe('gravity validation', () => {
      it('should accept positive gravity', () => {
        const content = `[gd_scene format=3]

[node name="PositiveGravity" type="Area3D"]
gravity = 9.8

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative gravity', () => {
        const content = `[gd_scene format=3]

[node name="NegativeGravity" type="Area3D"]
gravity = -9.8

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero gravity', () => {
        const content = `[gd_scene format=3]

[node name="ZeroGravity" type="Area3D"]
gravity = 0.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-numeric gravity', () => {
        const content = `[gd_scene format=3]

[node name="InvalidGravity" type="Area3D"]
gravity = "heavy"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('gravity'));
        expect(error).toBeDefined();
      });
    });

    describe('linear_damp_space_override validation', () => {
      it('should accept all valid values', () => {
        const validValues = [0, 1, 2, 3, 4];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="LinearDampOverride${value}" type="Area3D"]
linear_damp_space_override = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidLinearOverride" type="Area3D"]
linear_damp_space_override = 7
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('linear_damp_space_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-4');
      });
    });

    describe('linear_damp validation', () => {
      it('should accept valid linear_damp values', () => {
        const validValues = [0, 0.1, 1.0, 10.5];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="LinearDamp${value}" type="Area3D"]
linear_damp = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative linear_damp', () => {
        const content = `[gd_scene format=3]

[node name="NegativeDamp" type="Area3D"]
linear_damp = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('linear_damp'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('cannot be negative');
      });

      it('should reject non-numeric linear_damp', () => {
        const content = `[gd_scene format=3]

[node name="InvalidDamp" type="Area3D"]
linear_damp = "high"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('linear_damp'));
        expect(error).toBeDefined();
      });
    });

    describe('angular_damp_space_override validation', () => {
      it('should accept all valid values', () => {
        const validValues = [0, 1, 2, 3, 4];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="AngularDampOverride${value}" type="Area3D"]
angular_damp_space_override = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAngularOverride" type="Area3D"]
angular_damp_space_override = 8
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('angular_damp_space_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-4');
      });
    });

    describe('angular_damp validation', () => {
      it('should accept valid angular_damp values', () => {
        const validValues = [0, 0.5, 2.0, 15.0];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="AngularDamp${value}" type="Area3D"]
angular_damp = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative angular_damp', () => {
        const content = `[gd_scene format=3]

[node name="NegativeAngular" type="Area3D"]
angular_damp = -2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('angular_damp'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('cannot be negative');
      });
    });

    describe('priority validation', () => {
      it('should accept any numeric priority value', () => {
        const validValues = [0, 1.0, -1.0, 100.5];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="Priority${value}" type="Area3D"]
priority = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric priority', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPriority" type="Area3D"]
priority = "high"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('priority'));
        expect(error).toBeDefined();
      });
    });

    describe('audio_bus_override validation', () => {
      it('should accept true value', () => {
        const content = `[gd_scene format=3]

[node name="AudioOverrideTrue" type="Area3D"]
audio_bus_override = true
audio_bus_name = "Master"

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = `[gd_scene format=3]

[node name="AudioOverrideFalse" type="Area3D"]
audio_bus_override = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean audio_bus_override', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAudioOverride" type="Area3D"]
audio_bus_override = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('audio_bus_override'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });

    describe('audio_bus_name validation', () => {
      it('should accept valid audio_bus_name', () => {
        const content = `[gd_scene format=3]

[node name="ValidAudioBus" type="Area3D"]
audio_bus_name = "Master"

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept quoted audio_bus_name', () => {
        const content = `[gd_scene format=3]

[node name="QuotedAudioBus" type="Area3D"]
audio_bus_name = "SFX"

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('collision_layer validation', () => {
      it('should accept valid collision_layer values', () => {
        const validValues = [1, 100, 1048575]; // Non-zero values to avoid warning

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLayer${value}" type="Area3D"]
collision_layer = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should accept maximum collision_layer value', () => {
        const content = `[gd_scene format=3]

[node name="MaxLayer" type="Area3D"]
collision_layer = 1048575

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative collision_layer', () => {
        const content = `[gd_scene format=3]

[node name="NegativeLayer" type="Area3D"]
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

[node name="ExcessiveLayer" type="Area3D"]
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

[node name="InvalidLayer" type="Area3D"]
collision_layer = "layer1"
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

[node name="ValidMask${value}" type="Area3D"]
collision_mask = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative collision_mask', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMask" type="Area3D"]
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

[node name="ExcessiveMask" type="Area3D"]
collision_mask = 5000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_mask'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });
    });
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when Area3D has no CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="NoCollisionShape" type="Area3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'area3d-needs-collision-shape');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'Area3D',
      });
      expect(warning?.message).toContain('no CollisionShape3D children');
    });

    it('should pass when Area3D has CollisionShape3D child', () => {
      const content = `[gd_scene format=3]

[node name="WithCollisionShape" type="Area3D"]

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when Area3D has nested CollisionShape3D', () => {
      const content = `[gd_scene format=3]

[node name="WithNestedShape" type="Area3D"]

[node name="Container" type="Node3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when Area3D has multiple CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="MultipleShapes" type="Area3D"]

[node name="Shape1" type="CollisionShape3D" parent="."]

[node name="Shape2" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Monitoring Configuration)', () => {
    it('should warn when both monitoring and monitorable are false', () => {
      const content = `[gd_scene format=3]

[node name="InactiveArea" type="Area3D"]
monitoring = false
monitorable = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'area3d-inactive');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'Area3D',
      });
      expect(warning?.message).toContain('both');
      expect(warning?.message).toContain('cannot detect');
    });

    it('should not warn when only monitoring is false', () => {
      const content = `[gd_scene format=3]

[node name="MonitorablOnly" type="Area3D"]
monitoring = false
monitorable = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not warn when only monitorable is false', () => {
      const content = `[gd_scene format=3]

[node name="MonitoringOnly" type="Area3D"]
monitoring = true
monitorable = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not warn when both are true (default)', () => {
      const content = `[gd_scene format=3]

[node name="ActiveArea" type="Area3D"]

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Point Gravity)', () => {
    it('should error when gravity_point is true but gravity_point_unit_distance is not set', () => {
      const content = `[gd_scene format=3]

[node name="PointGravityNoDistance" type="Area3D"]
gravity_point = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const error = diagnostics.find(d => d.ruleName === 'area3d-point-gravity-missing-distance');
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        severity: 'error',
        nodeType: 'Area3D',
      });
      expect(error?.message).toContain('gravity_point_unit_distance');
      expect(error?.message).toContain('required');
    });

    it('should pass when gravity_point is true and gravity_point_unit_distance is set', () => {
      const content = `[gd_scene format=3]

[node name="ValidPointGravity" type="Area3D"]
gravity_point = true
gravity_point_unit_distance = 10.0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not check gravity_point_unit_distance when gravity_point is false', () => {
      const content = `[gd_scene format=3]

[node name="NoPointGravity" type="Area3D"]
gravity_point = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0 and monitoring is true', () => {
      const content = `[gd_scene format=3]

[node name="ZeroLayer" type="Area3D"]
monitoring = true
collision_layer = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'area3d-monitoring-zero-layer');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'Area3D',
      });
    });

    it('should warn when collision_mask is 0 and monitoring is true', () => {
      const content = `[gd_scene format=3]

[node name="ZeroMask" type="Area3D"]
monitoring = true
collision_mask = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'area3d-monitoring-zero-mask');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'Area3D',
      });
    });

    it('should warn when both collision_layer and collision_mask are 0 with monitoring', () => {
      const content = `[gd_scene format=3]

[node name="ZeroBoth" type="Area3D"]
monitoring = true
collision_layer = 0
collision_mask = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'area3d-monitoring-no-collision');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'Area3D',
      });
    });

    it('should not warn when monitoring is false', () => {
      const content = `[gd_scene format=3]

[node name="MonitoringOff" type="Area3D"]
monitoring = false
collision_layer = 0
collision_mask = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not warn when collision values are non-zero', () => {
      const content = `[gd_scene format=3]

[node name="ValidCollision" type="Area3D"]
monitoring = true
collision_layer = 1
collision_mask = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Audio Bus)', () => {
    it('should warn when audio_bus_override is true but audio_bus_name is not set', () => {
      const content = `[gd_scene format=3]

[node name="AudioOverrideNoName" type="Area3D"]
audio_bus_override = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'area3d-audio-override-missing-name');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'Area3D',
      });
      expect(warning?.message).toContain('audio_bus_name');
    });

    it('should pass when audio_bus_override is true and audio_bus_name is set', () => {
      const content = `[gd_scene format=3]

[node name="ValidAudioOverride" type="Area3D"]
audio_bus_override = true
audio_bus_name = "Master"

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not check audio_bus_name when audio_bus_override is false', () => {
      const content = `[gd_scene format=3]

[node name="NoAudioOverride" type="Area3D"]
audio_bus_override = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="Area3D"]
space_override = 10
gravity_point_unit_distance = -5
collision_layer = -1
monitoring = "invalid"
`;

      const diagnostics = linter.lint(content);
      // Should have multiple errors from format validation
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="ComplexArea" type="Area3D"]
monitoring = true
monitorable = true
space_override = 3
gravity_space_override = 3
gravity_point = true
gravity_point_center = Vector3(0, 0, 0)
gravity_point_unit_distance = 5.0
gravity_direction = Vector3(0, -1, 0)
gravity = 9.8
linear_damp_space_override = 1
linear_damp = 0.1
angular_damp_space_override = 1
angular_damp = 0.1
priority = 1.0
audio_bus_override = true
audio_bus_name = "SFX"
collision_layer = 1
collision_mask = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptyArea" type="Area3D"]
`;

      const diagnostics = linter.lint(content);
      // Should only have warning about missing CollisionShape3D
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].ruleName).toBe('area3d-needs-collision-shape');
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[node name="ScientificNotation" type="Area3D"]
gravity = 9.8e0
gravity_point_unit_distance = 1e1
linear_damp = 1.5e-2
gravity_direction = Vector3(1e-5, -1e0, 0e0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle bitmask boundaries', () => {
      const content = `[gd_scene format=3]

[node name="BitmaskBoundary" type="Area3D"]
collision_layer = 1048575
collision_mask = 1048575

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should combine format and semantic errors', () => {
      const content = `[gd_scene format=3]

[node name="CombinedErrors" type="Area3D"]
gravity_point = true
gravity_point_unit_distance = 0
monitoring = false
monitorable = false
`;

      const diagnostics = linter.lint(content);
      // Should have format error for zero distance + semantic errors
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasFormatError = diagnostics.some(d => d.message.includes('greater than 0'));
      const hasSemanticError = diagnostics.some(d => d.ruleName === 'area3d-inactive');
      const hasMissingShape = diagnostics.some(d => d.ruleName === 'area3d-needs-collision-shape');
      expect(hasFormatError || hasSemanticError || hasMissingShape).toBe(true);
    });
  });
});
