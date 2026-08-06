/**
 * Tests for CharacterBody3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  collisionShape3d,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('CharacterBody3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CharacterBody3D properties', () => {
      expectClean(
        scene(
          node('CharacterBody3D', {
            motion_mode: 0,
            up_direction: 'Vector3(0, 1, 0)',
            velocity: 'Vector3(0, 0, 0)',
            floor_stop_on_slope: true,
            floor_constant_speed: false,
            floor_block_on_wall: true,
            floor_max_angle: 0.785398,
            floor_snap_length: 0.1,
            wall_min_slide_angle: 0.261799,
            platform_on_leave: 0,
            platform_floor_layers: 4294967295,
            platform_wall_layers: 0,
            safe_margin: 0.001,
            collision_layer: 1,
            collision_mask: 1,
            collision_priority: 1.0,
            max_slides: 4,
            disable_mode: 0,
          }),
          collisionShape3d
        )
      );
    });

    runPropertyValidation({ nodeType: 'CharacterBody3D', acceptChild: collisionShape3d }, [
      {
        prop: 'motion_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }, { value: '"grounded"' }],
      },
      {
        prop: 'up_direction',
        valid: ['Vector3(0, 1, 0)'],
        invalid: [{ value: 'Vector3(0, 1)', contains: ['Vector3 with 3 numbers'] }],
      },
      {
        prop: 'velocity',
        valid: ['Vector3(1.5, -2.3, 0.5)'],
        invalid: [{ value: 'Vector2(1, 2)' }],
      },
      { prop: 'floor_stop_on_slope', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'floor_constant_speed', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      { prop: 'floor_block_on_wall', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
      {
        // Godot hints "0,180,0.1,radians_as_degrees" with no `or_greater`, so
        // PI is the last legal value; this table used to stop at PI/2 and
        // rejected the upper half of the range as an error.
        prop: 'floor_max_angle',
        valid: [0, 0.785398, 1.5708, 3.14159],
        invalid: [
          { value: 4.0, contains: ['radians'] },
          { value: -0.5 },
          { value: '"45 degrees"' },
        ],
      },
      {
        prop: 'wall_min_slide_angle',
        valid: [0, 0.261799, 0.785398, 1.5708, 2.0, 3.14159],
        invalid: [{ value: 4.0, contains: ['radians'] }, { value: -0.1 }],
      },
      {
        prop: 'platform_on_leave',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
      {
        prop: 'platform_floor_layers',
        valid: [0, 1, 255, 4294967295],
        invalid: [{ value: 5000000000, contains: ['4294967295'] }, { value: -1 }],
      },
      { prop: 'platform_wall_layers', valid: [0, 1, 65535, 4294967295] },
      { prop: 'collision_priority', valid: [0.0, 0.5, 1.0, -1.0, 100.5], invalid: [{ value: '"high"' }] },
      {
        // 2 is KEEP_ACTIVE — collision_object_2d.cpp:654 and its 3D twin bind
        // three constants. This table asserted 0-1 and encoded the bug.
        prop: 'disable_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
    ]);

    describe('up_direction validation', () => {
      // character_body_3d.cpp's setter assigns whatever it is given, so an
      // infinite component is stored — and it is not the standard up vector.
      it('warns on a non-finite up_direction without calling it malformed', () => {
        expectDiagnostic(
          scene(node('CharacterBody3D', { up_direction: 'Vector3(0, inf, 0)' }), collisionShape3d),
          { ruleName: 'characterbody3d-non-standard-up-direction', severity: 'warning' }
        );
      });

      it('should warn about non-standard up_direction', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { up_direction: 'Vector3(0, 0, 1)' }), collisionShape3d), {
          ruleName: 'characterbody3d-non-standard-up-direction',
          severity: 'warning',
        });
      });
    });

    describe('floor_snap_length validation', () => {
      it('should accept valid floor_snap_length values', () => {
        for (const value of [0, 0.001, 0.1, 1.0, 5.0]) {
          // May have warnings for extreme values, but no errors
          expectNoErrors(scene(node('CharacterBody3D', { floor_snap_length: value }), collisionShape3d));
        }
      });

      it('should reject negative floor_snap_length', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { floor_snap_length: -0.5 })), {
          prop: 'floor_snap_length',
          severity: 'error',
          contains: ['>= 0'],
        });
      });

      // character_body_3d.cpp:934 hints "0,1,0.01,or_greater" — the high end is
      // open and the low end is the setter's own ERR_FAIL — so no advisory survives.
      it.each([0.0001, 5, 50, 500])('says nothing about floor_snap_length %s', (snap) => {
        expectClean(scene(node('CharacterBody3D', { floor_snap_length: snap }), collisionShape3d));
      });
    });

    describe('safe_margin validation', () => {
      it('should accept valid safe_margin values', () => {
        for (const value of [0, 0.001, 0.01, 0.1]) {
          // May have warnings for large values, but no errors
          expectNoErrors(scene(node('CharacterBody3D', { safe_margin: value }), collisionShape3d));
        }
      });

      // character_body_3d.cpp:636 is a bare assignment, so the hint at :942
      // ("0.001,256,0.001") only warns — a negative is no longer an error.
      it('should warn, not error, on negative safe_margin', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { safe_margin: -0.5 }), collisionShape3d), {
          ruleName: 'characterbody3d-safe-margin-too-small',
          severity: 'warning',
          contains: ['-0.5', '0.001'],
        });
      });

      it('should warn about safe_margin above the hint', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { safe_margin: 300 }), collisionShape3d), {
          ruleName: 'characterbody3d-safe-margin-too-large',
          severity: 'warning',
          contains: ['300', '256'],
        });
      });

      it.each([0.001, 0.5, 256])('says nothing about safe_margin %s', (margin) => {
        expectClean(scene(node('CharacterBody3D', { safe_margin: margin }), collisionShape3d));
      });
    });

    describe('collision_layer validation', () => {
      it('should accept valid collision_layer values', () => {
        for (const value of [0, 1, 100, 1048575]) {
          // May have warning for 0 layer, but no errors
          expectNoErrors(scene(node('CharacterBody3D', { collision_layer: value }), collisionShape3d));
        }
      });

      // collision_object_3d.cpp:506 hints PROPERTY_HINT_LAYERS_3D_PHYSICS, a
      // 32-checkbox widget, and the setter assigns unconditionally: the width
      // is the inspector's, so out of range warns rather than erroring.
      it('should warn on negative collision_layer', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { collision_layer: -1 })), {
          prop: 'collision_layer',
          severity: 'warning',
          contains: ['between 0 and 4294967295'],
        });
      });

      it('should warn on collision_layer exceeding the 32-bit maximum', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { collision_layer: 4294967296 })), {
          prop: 'collision_layer',
          severity: 'warning',
          contains: ['between 0 and 4294967295'],
        });
      });
    });

    describe('collision_mask validation', () => {
      it('should accept valid collision_mask values', () => {
        for (const value of [0, 1, 255, 1048575]) {
          // May have warning for 0 mask, but no errors
          expectNoErrors(scene(node('CharacterBody3D', { collision_mask: value }), collisionShape3d));
        }
      });

      it('should warn on negative collision_mask', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { collision_mask: -5 })), {
          prop: 'collision_mask',
          severity: 'warning',
        });
      });
    });

    describe('max_slides validation', () => {
      it('should accept valid max_slides values', () => {
        for (const value of [1, 4, 6, 10]) {
          // May have warnings for low values, but no errors
          expectNoErrors(scene(node('CharacterBody3D', { max_slides: value }), collisionShape3d));
        }
      });

      it('should reject zero max_slides', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { max_slides: 0 })), {
          prop: 'max_slides',
          severity: 'error',
          contains: ['greater than 0'],
        });
      });

      it('should reject negative max_slides', () => {
        expectDiagnostic(scene(node('CharacterBody3D', { max_slides: -1 })), {
          prop: 'max_slides',
          severity: 'error',
        });
      });

      // character_body_3d.cpp:926 declares max_slides PROPERTY_HINT_NONE with
      // PROPERTY_USAGE_NO_EDITOR, so there is no band to be low in.
      it.each([1, 2, 3])('says nothing about max_slides %s', (slides) => {
        expectClean(scene(node('CharacterBody3D', { max_slides: slides }), collisionShape3d));
      });
    });
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when CharacterBody3D has no CollisionShape3D children', () => {
      expectDiagnostic(scene(node('CharacterBody3D')), {
        ruleName: 'characterbody3d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'CharacterBody3D',
        contains: ['no CollisionShape3D children'],
      });
    });

    it('should pass when CharacterBody3D has CollisionShape3D child', () => {
      expectNoDiagnostic(scene(node('CharacterBody3D'), collisionShape3d), {
        ruleName: 'characterbody3d-needs-collision-shape',
      });
    });

    it('should pass when CharacterBody3D has nested CollisionShape3D', () => {
      expectNoDiagnostic(
        scene(
          node('CharacterBody3D'),
          node('Node3D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape3D', {}, { parent: 'Container' })
        ),
        { ruleName: 'characterbody3d-needs-collision-shape' }
      );
    });

    it('should pass when CharacterBody3D has multiple CollisionShape3D children', () => {
      expectNoDiagnostic(
        scene(
          node('CharacterBody3D'),
          node('CollisionShape3D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape3D', {}, { name: 'Shape2', parent: '.' })
        ),
        { ruleName: 'characterbody3d-needs-collision-shape' }
      );
    });
  });

  describe('Semantic Validation (Motion Mode Settings)', () => {
    it('should warn when floor properties are set in FLOATING mode', () => {
      expectDiagnostic(
        scene(
          node('CharacterBody3D', {
            motion_mode: 1,
            floor_stop_on_slope: true,
            floor_max_angle: 0.785398,
          }),
          collisionShape3d
        ),
        {
          ruleName: 'characterbody3d-floor-props-in-floating-mode',
          severity: 'warning',
          contains: ['FLOATING', 'GROUNDED'],
        }
      );
    });

    it('should not warn when floor properties are set in GROUNDED mode', () => {
      expectNoDiagnostic(
        scene(
          node('CharacterBody3D', {
            motion_mode: 0,
            floor_stop_on_slope: true,
            floor_max_angle: 0.785398,
          }),
          collisionShape3d
        ),
        { ruleName: 'characterbody3d-floor-props-in-floating-mode' }
      );
    });

    it('should not warn when floor properties are set without explicit motion_mode (defaults to GROUNDED)', () => {
      expectNoDiagnostic(scene(node('CharacterBody3D', { floor_stop_on_slope: true }), collisionShape3d), {
        ruleName: 'characterbody3d-floor-props-in-floating-mode',
      });
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      expectDiagnostic(scene(node('CharacterBody3D', { collision_layer: 0 }), collisionShape3d), {
        ruleName: 'characterbody3d-zero-collision-layer',
        severity: 'warning',
        nodeType: 'CharacterBody3D',
        contains: ['collision_layer set to 0'],
      });
    });

    it('should not warn when collision_layer is non-zero', () => {
      expectNoDiagnostic(scene(node('CharacterBody3D', { collision_layer: 1 }), collisionShape3d), {
        ruleName: 'characterbody3d-zero-collision-layer',
      });
    });

    it('should warn when collision_mask is 0', () => {
      expectDiagnostic(scene(node('CharacterBody3D', { collision_mask: 0 }), collisionShape3d), {
        ruleName: 'characterbody3d-zero-collision-mask',
        severity: 'warning',
        nodeType: 'CharacterBody3D',
        contains: ['collision_mask set to 0'],
      });
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectNoDiagnostic(scene(node('CharacterBody3D', { collision_mask: 1 }), collisionShape3d), {
        ruleName: 'characterbody3d-zero-collision-mask',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('CharacterBody3D', {
            motion_mode: 10,
            floor_max_angle: 5.0,
            max_slides: 0,
            collision_layer: -5,
          })
        )
      );
      // Should have multiple errors: motion_mode, floor_max_angle, max_slides, collision_layer
      expect(diagnostics.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('CharacterBody3D', {
            motion_mode: 0,
            up_direction: 'Vector3(0, 1, 0)',
            velocity: 'Vector3(0, 0, 0)',
            floor_stop_on_slope: true,
            floor_constant_speed: false,
            floor_block_on_wall: true,
            floor_max_angle: 0.785398,
            floor_snap_length: 0.1,
            wall_min_slide_angle: 0.261799,
            platform_on_leave: 0,
            platform_floor_layers: 4294967295,
            platform_wall_layers: 0,
            safe_margin: 0.001,
            collision_layer: 1,
            collision_mask: 1,
            collision_priority: 1.0,
            max_slides: 4,
            disable_mode: 0,
          }),
          collisionShape3d
        )
      );
    });

    it('should handle node with minimal properties', () => {
      // Should pass without errors
      expectNoErrors(scene(node('CharacterBody3D'), collisionShape3d));
    });

    it('should handle scientific notation in numeric properties', () => {
      expectClean(
        scene(
          node('CharacterBody3D', {
            floor_max_angle: '7.85398e-1',
            floor_snap_length: '1.0e-1',
            safe_margin: '1e-3',
            velocity: 'Vector3(1.5e2, -2.3e1, 5e-1)',
          }),
          collisionShape3d
        )
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(
        scene(
          node('CharacterBody3D', {
            collision_layer: 1048575,
            collision_mask: 1048575,
            platform_floor_layers: 4294967295,
            platform_wall_layers: 4294967295,
          }),
          collisionShape3d
        )
      );
    });

    it('should handle combination of warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('CharacterBody3D', {
            // character_body_3d.cpp:922 hints "Grounded,Floating" but
            // set_motion_mode is a bare assignment, so out-of-range warns
            // rather than errors.
            motion_mode: 10,
            floor_snap_length: 50,
            // collision_layer warns rather than errors now: its width comes
            // from the 32-checkbox widget, not the engine. max_slides carries
            // the error, since set_max_slides ERR_FAILs below 1 (character_body_3d.cpp:813).
            collision_layer: -5,
            max_slides: 0,
          }),
          collisionShape3d
        )
      );
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(d => d.message.includes('max_slides'))).toBe(true);
      const layerDiagnostic = diagnostics.find(d => d.message.includes('collision_layer'));
      expect(layerDiagnostic?.severity).toBe('warning');
      const motionModeDiagnostic = diagnostics.find(d => d.message.includes('motion_mode'));
      expect(motionModeDiagnostic).toBeDefined();
      expect(motionModeDiagnostic?.severity).toBe('warning');
    });

    it('should handle zero values correctly', () => {
      // Zero values are valid for these properties
      expectNoErrors(
        scene(
          node('CharacterBody3D', {
            floor_snap_length: 0,
            safe_margin: 0,
            platform_floor_layers: 0,
            platform_wall_layers: 0,
          }),
          collisionShape3d
        )
      );
    });
  });
});
