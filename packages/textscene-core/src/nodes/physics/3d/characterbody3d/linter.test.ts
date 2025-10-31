/**
 * Tests for CharacterBody3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('CharacterBody3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CharacterBody3D properties', () => {
      const content = `[gd_scene format=3]

[node name="ValidCharacterBody" type="CharacterBody3D"]
motion_mode = 0
up_direction = Vector3(0, 1, 0)
velocity = Vector3(0, 0, 0)
floor_stop_on_slope = true
floor_constant_speed = false
floor_block_on_wall = true
floor_max_angle = 0.785398
floor_snap_length = 0.1
wall_min_slide_angle = 0.261799
platform_on_leave = 0
platform_floor_layers = 4294967295
platform_wall_layers = 0
safe_margin = 0.001
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
max_slides = 4
disable_mode = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('motion_mode validation', () => {
      it('should accept valid motion_mode values', () => {
        const validValues = [0, 1]; // GROUNDED, FLOATING

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMotionMode${value}" type="CharacterBody3D"]
motion_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid motion_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMotionMode" type="CharacterBody3D"]
motion_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('motion_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-1');
      });

      it('should reject non-numeric motion_mode', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMotionMode" type="CharacterBody3D"]
motion_mode = "grounded"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('motion_mode'));
        expect(error).toBeDefined();
      });
    });

    describe('up_direction validation', () => {
      it('should accept valid up_direction Vector3', () => {
        const content = `[gd_scene format=3]

[node name="ValidUpDirection" type="CharacterBody3D"]
up_direction = Vector3(0, 1, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept custom up_direction', () => {
        const content = `[gd_scene format=3]

[node name="CustomUpDirection" type="CharacterBody3D"]
up_direction = Vector3(0, 0, 1)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        // Should have info diagnostic about non-standard up direction
        const info = diagnostics.find(d => d.ruleName === 'characterbody3d-non-standard-up-direction');
        expect(info).toBeDefined();
        expect(info?.severity).toBe('info');
      });

      it('should reject invalid up_direction format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidUpDirection" type="CharacterBody3D"]
up_direction = Vector3(0, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('up_direction'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Vector3 with 3 numbers');
      });
    });

    describe('velocity validation', () => {
      it('should accept valid velocity Vector3', () => {
        const content = `[gd_scene format=3]

[node name="ValidVelocity" type="CharacterBody3D"]
velocity = Vector3(1.5, -2.3, 0.5)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid velocity format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidVelocity" type="CharacterBody3D"]
velocity = Vector2(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('velocity'));
        expect(error).toBeDefined();
      });
    });

    describe('boolean floor properties validation', () => {
      const booleanProps = ['floor_stop_on_slope', 'floor_constant_speed', 'floor_block_on_wall'];

      for (const prop of booleanProps) {
        it(`should accept true value for ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="ValidBool" type="CharacterBody3D"]
${prop} = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        });

        it(`should accept false value for ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="ValidBool" type="CharacterBody3D"]
${prop} = false

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        });

        it(`should reject non-boolean ${prop}`, () => {
          const content = `[gd_scene format=3]

[node name="InvalidBool" type="CharacterBody3D"]
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

    describe('floor_max_angle validation', () => {
      it('should accept valid floor_max_angle in radians', () => {
        const validAngles = [0, 0.785398, 1.5708]; // 0°, 45°, 90° in radians

        for (const angle of validAngles) {
          const content = `[gd_scene format=3]

[node name="ValidFloorAngle${angle}" type="CharacterBody3D"]
floor_max_angle = ${angle}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject floor_max_angle exceeding max (90 degrees)', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveFloorAngle" type="CharacterBody3D"]
floor_max_angle = 3.14159
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('floor_max_angle'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('radians');
      });

      it('should reject negative floor_max_angle', () => {
        const content = `[gd_scene format=3]

[node name="NegativeFloorAngle" type="CharacterBody3D"]
floor_max_angle = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('floor_max_angle'));
        expect(error).toBeDefined();
      });

      it('should reject non-numeric floor_max_angle', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFloorAngle" type="CharacterBody3D"]
floor_max_angle = "45 degrees"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('floor_max_angle'));
        expect(error).toBeDefined();
      });
    });

    describe('floor_snap_length validation', () => {
      it('should accept valid floor_snap_length values', () => {
        const validValues = [0, 0.001, 0.1, 1.0, 5.0];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidSnapLength${value}" type="CharacterBody3D"]
floor_snap_length = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warnings for extreme values, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject negative floor_snap_length', () => {
        const content = `[gd_scene format=3]

[node name="NegativeSnapLength" type="CharacterBody3D"]
floor_snap_length = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('floor_snap_length') && d.severity === 'error');
        expect(error).toBeDefined();
        expect(error?.message).toContain('>= 0');
      });

      it('should warn about very small floor_snap_length', () => {
        const content = `[gd_scene format=3]

[node name="SmallSnapLength" type="CharacterBody3D"]
floor_snap_length = 0.0001

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-floor-snap-too-small');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('may not work reliably');
      });

      it('should warn about very large floor_snap_length', () => {
        const content = `[gd_scene format=3]

[node name="LargeSnapLength" type="CharacterBody3D"]
floor_snap_length = 50

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-floor-snap-too-large');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('glitchy behavior');
      });
    });

    describe('wall_min_slide_angle validation', () => {
      it('should accept valid wall_min_slide_angle in radians', () => {
        const validAngles = [0, 0.261799, 0.785398, 1.5708]; // 0°, 15°, 45°, 90° in radians

        for (const angle of validAngles) {
          const content = `[gd_scene format=3]

[node name="ValidWallAngle${angle}" type="CharacterBody3D"]
wall_min_slide_angle = ${angle}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject wall_min_slide_angle exceeding max (90 degrees)', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveWallAngle" type="CharacterBody3D"]
wall_min_slide_angle = 2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('wall_min_slide_angle'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('radians');
      });

      it('should reject negative wall_min_slide_angle', () => {
        const content = `[gd_scene format=3]

[node name="NegativeWallAngle" type="CharacterBody3D"]
wall_min_slide_angle = -0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('wall_min_slide_angle'));
        expect(error).toBeDefined();
      });
    });

    describe('platform_on_leave validation', () => {
      it('should accept valid platform_on_leave values', () => {
        const validValues = [0, 1, 2]; // ADD_VELOCITY, ADD_UPWARD_VELOCITY, DO_NOTHING

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidPlatformLeave${value}" type="CharacterBody3D"]
platform_on_leave = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid platform_on_leave value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPlatformLeave" type="CharacterBody3D"]
platform_on_leave = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('platform_on_leave'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('0-2');
      });
    });

    describe('platform layer bitmask validation', () => {
      it('should accept valid platform_floor_layers bitmask', () => {
        const validValues = [0, 1, 255, 4294967295]; // Various 32-bit values

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidPlatformFloorLayers${value}" type="CharacterBody3D"]
platform_floor_layers = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject platform_floor_layers exceeding max', () => {
        const content = `[gd_scene format=3]

[node name="ExcessivePlatformFloorLayers" type="CharacterBody3D"]
platform_floor_layers = 5000000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('platform_floor_layers'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('4294967295');
      });

      it('should accept valid platform_wall_layers bitmask', () => {
        const validValues = [0, 1, 65535, 4294967295];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidPlatformWallLayers${value}" type="CharacterBody3D"]
platform_wall_layers = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative platform layer bitmasks', () => {
        const content = `[gd_scene format=3]

[node name="NegativePlatformLayers" type="CharacterBody3D"]
platform_floor_layers = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('platform_floor_layers'));
        expect(error).toBeDefined();
      });
    });

    describe('safe_margin validation', () => {
      it('should accept valid safe_margin values', () => {
        const validValues = [0, 0.001, 0.01, 0.1];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidSafeMargin${value}" type="CharacterBody3D"]
safe_margin = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warnings for large values, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject negative safe_margin', () => {
        const content = `[gd_scene format=3]

[node name="NegativeSafeMargin" type="CharacterBody3D"]
safe_margin = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('safe_margin') && d.severity === 'error');
        expect(error).toBeDefined();
        expect(error?.message).toContain('>= 0');
      });

      it('should warn about very large safe_margin', () => {
        const content = `[gd_scene format=3]

[node name="LargeSafeMargin" type="CharacterBody3D"]
safe_margin = 0.5

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-safe-margin-too-large');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('collision detection issues');
      });
    });

    describe('collision_layer validation', () => {
      it('should accept valid collision_layer values', () => {
        const validValues = [0, 1, 100, 1048575];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLayer${value}" type="CharacterBody3D"]
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

[node name="NegativeLayer" type="CharacterBody3D"]
collision_layer = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_layer') && d.severity === 'error');
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });

      it('should reject collision_layer exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveLayer" type="CharacterBody3D"]
collision_layer = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_layer') && d.severity === 'error');
        expect(error).toBeDefined();
        expect(error?.message).toContain('between 0 and 1048575');
      });
    });

    describe('collision_mask validation', () => {
      it('should accept valid collision_mask values', () => {
        const validValues = [0, 1, 255, 1048575];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMask${value}" type="CharacterBody3D"]
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

[node name="NegativeMask" type="CharacterBody3D"]
collision_mask = -5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_mask') && d.severity === 'error');
        expect(error).toBeDefined();
      });
    });

    describe('collision_priority validation', () => {
      it('should accept valid collision_priority values', () => {
        const validValues = [0.0, 0.5, 1.0, -1.0, 100.5];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidPriority${value}" type="CharacterBody3D"]
collision_priority = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric collision_priority', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPriority" type="CharacterBody3D"]
collision_priority = "high"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('collision_priority'));
        expect(error).toBeDefined();
      });
    });

    describe('max_slides validation', () => {
      it('should accept valid max_slides values', () => {
        const validValues = [1, 4, 6, 10];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidMaxSlides${value}" type="CharacterBody3D"]
max_slides = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          // May have warnings for low values, but no errors
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject zero max_slides', () => {
        const content = `[gd_scene format=3]

[node name="ZeroMaxSlides" type="CharacterBody3D"]
max_slides = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('max_slides') && d.severity === 'error');
        expect(error).toBeDefined();
        expect(error?.message).toContain('greater than 0');
      });

      it('should reject negative max_slides', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMaxSlides" type="CharacterBody3D"]
max_slides = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('max_slides') && d.severity === 'error');
        expect(error).toBeDefined();
      });

      it('should warn about low max_slides', () => {
        const content = `[gd_scene format=3]

[node name="LowMaxSlides" type="CharacterBody3D"]
max_slides = 2

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-max-slides-too-low');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('jittery movement');
      });
    });

    describe('disable_mode validation', () => {
      it('should accept valid disable_mode values', () => {
        const validValues = [0, 1]; // REMOVE, KEEP_ACTIVE

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidDisableMode${value}" type="CharacterBody3D"]
disable_mode = ${value}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid disable_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidDisableMode" type="CharacterBody3D"]
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

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when CharacterBody3D has no CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="NoCollisionShape" type="CharacterBody3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-needs-collision-shape');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'CharacterBody3D',
      });
      expect(warning?.message).toContain('no CollisionShape3D children');
    });

    it('should pass when CharacterBody3D has CollisionShape3D child', () => {
      const content = `[gd_scene format=3]

[node name="WithCollisionShape" type="CharacterBody3D"]

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have no collision shape warning
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-needs-collision-shape');
      expect(warning).toBeUndefined();
    });

    it('should pass when CharacterBody3D has nested CollisionShape3D', () => {
      const content = `[gd_scene format=3]

[node name="WithNestedShape" type="CharacterBody3D"]

[node name="Container" type="Node3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-needs-collision-shape');
      expect(warning).toBeUndefined();
    });

    it('should pass when CharacterBody3D has multiple CollisionShape3D children', () => {
      const content = `[gd_scene format=3]

[node name="MultipleShapes" type="CharacterBody3D"]

[node name="Shape1" type="CollisionShape3D" parent="."]

[node name="Shape2" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-needs-collision-shape');
      expect(warning).toBeUndefined();
    });
  });

  describe('Semantic Validation (Motion Mode Settings)', () => {
    it('should warn when floor properties are set in FLOATING mode', () => {
      const content = `[gd_scene format=3]

[node name="FloatingWithFloorProps" type="CharacterBody3D"]
motion_mode = 1
floor_stop_on_slope = true
floor_max_angle = 0.785398

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-floor-props-in-floating-mode');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
      expect(warning?.message).toContain('FLOATING');
      expect(warning?.message).toContain('GROUNDED');
    });

    it('should not warn when floor properties are set in GROUNDED mode', () => {
      const content = `[gd_scene format=3]

[node name="GroundedWithFloorProps" type="CharacterBody3D"]
motion_mode = 0
floor_stop_on_slope = true
floor_max_angle = 0.785398

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-floor-props-in-floating-mode');
      expect(warning).toBeUndefined();
    });

    it('should not warn when floor properties are set without explicit motion_mode (defaults to GROUNDED)', () => {
      const content = `[gd_scene format=3]

[node name="DefaultGrounded" type="CharacterBody3D"]
floor_stop_on_slope = true

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-floor-props-in-floating-mode');
      expect(warning).toBeUndefined();
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoLayer" type="CharacterBody3D"]
collision_layer = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-zero-collision-layer');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'CharacterBody3D',
      });
      expect(warning?.message).toContain('collision_layer set to 0');
    });

    it('should not warn when collision_layer is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithLayer" type="CharacterBody3D"]
collision_layer = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-zero-collision-layer');
      expect(warning).toBeUndefined();
    });

    it('should warn when collision_mask is 0', () => {
      const content = `[gd_scene format=3]

[node name="NoMask" type="CharacterBody3D"]
collision_mask = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-zero-collision-mask');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeType: 'CharacterBody3D',
      });
      expect(warning?.message).toContain('collision_mask set to 0');
    });

    it('should not warn when collision_mask is non-zero', () => {
      const content = `[gd_scene format=3]

[node name="WithMask" type="CharacterBody3D"]
collision_mask = 1

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'characterbody3d-zero-collision-mask');
      expect(warning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="CharacterBody3D"]
motion_mode = 10
floor_max_angle = 5.0
max_slides = 0
collision_layer = -5
`;

      const diagnostics = linter.lint(content);
      // Should have multiple errors: motion_mode, floor_max_angle, max_slides, collision_layer
      expect(diagnostics.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="ComplexCharacterBody" type="CharacterBody3D"]
motion_mode = 0
up_direction = Vector3(0, 1, 0)
velocity = Vector3(0, 0, 0)
floor_stop_on_slope = true
floor_constant_speed = false
floor_block_on_wall = true
floor_max_angle = 0.785398
floor_snap_length = 0.1
wall_min_slide_angle = 0.261799
platform_on_leave = 0
platform_floor_layers = 4294967295
platform_wall_layers = 0
safe_margin = 0.001
collision_layer = 1
collision_mask = 1
collision_priority = 1.0
max_slides = 4
disable_mode = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with minimal properties', () => {
      const content = `[gd_scene format=3]

[node name="MinimalCharacterBody" type="CharacterBody3D"]

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should pass without errors
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should handle scientific notation in numeric properties', () => {
      const content = `[gd_scene format=3]

[node name="ScientificNotation" type="CharacterBody3D"]
floor_max_angle = 7.85398e-1
floor_snap_length = 1.0e-1
safe_margin = 1e-3
velocity = Vector3(1.5e2, -2.3e1, 5e-1)

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle bitmask boundaries', () => {
      const content = `[gd_scene format=3]

[node name="BitmaskBoundary" type="CharacterBody3D"]
collision_layer = 1048575
collision_mask = 1048575
platform_floor_layers = 4294967295
platform_wall_layers = 4294967295

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle combination of warnings and errors', () => {
      const content = `[gd_scene format=3]

[node name="WarningsAndErrors" type="CharacterBody3D"]
motion_mode = 10
floor_snap_length = 50
collision_layer = 0
max_slides = 2

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should have at least one error (motion_mode=10 is invalid)
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      // Check that the motion_mode error is present
      const motionModeError = diagnostics.find(d => d.message.includes('motion_mode'));
      expect(motionModeError).toBeDefined();
    });

    it('should handle zero values correctly', () => {
      const content = `[gd_scene format=3]

[node name="ZeroValues" type="CharacterBody3D"]
floor_snap_length = 0
safe_margin = 0
platform_floor_layers = 0
platform_wall_layers = 0

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Zero values are valid for these properties
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });
});
