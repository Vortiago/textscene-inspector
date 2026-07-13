/**
 * Tests for CharacterBody2D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  collisionShape2d,
  expectClean,
  expectNoErrors,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('CharacterBody2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CharacterBody2D properties', () => {
      expectClean(
        scene(
          node('CharacterBody2D', {
            motion_mode: 0,
            up_direction: 'Vector2(0, -1)',
            velocity: 'Vector2(0, 0)',
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
          collisionShape2d
        )
      );
    });

    runPropertyValidation({ nodeType: 'CharacterBody2D', acceptChild: collisionShape2d }, [
      {
        prop: 'motion_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }, { value: '"grounded"' }],
      },
      {
        prop: 'up_direction',
        valid: ['Vector2(0, -1)'],
        invalid: [
          { value: 'Vector2(0)', contains: ['Vector2 with 2 numbers'] },
          { value: 'Vector3(0, 1, 0)' },
        ],
      },
      {
        prop: 'velocity',
        valid: ['Vector2(1.5, -2.3)'],
        invalid: [{ value: 'Vector3(1, 2, 3)' }],
      },
      {
        prop: 'floor_stop_on_slope',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'floor_constant_speed',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'floor_block_on_wall',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'floor_max_angle',
        valid: [0, 0.785398, 1.5708],
        invalid: [
          { value: 3.14159, contains: ['radians'] },
          { value: -0.5 },
          { value: '"45 degrees"' },
        ],
      },
      {
        prop: 'floor_snap_length',
        valid: [0, 0.001, 0.1, 1.0, 5.0],
        invalid: [{ value: -0.5, contains: ['>= 0'] }],
      },
      {
        prop: 'wall_min_slide_angle',
        valid: [0, 0.261799, 0.785398, 1.5708],
        invalid: [{ value: 2.0, contains: ['radians'] }, { value: -0.1 }],
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
      {
        prop: 'platform_wall_layers',
        valid: [0, 1, 65535, 4294967295],
      },
      {
        prop: 'safe_margin',
        valid: [0, 0.001, 0.01, 0.1],
        invalid: [{ value: -0.5, contains: ['>= 0'] }],
      },
      {
        prop: 'collision_priority',
        valid: [0.0, 0.5, 1.0, -1.0, 100.5],
        invalid: [{ value: '"high"' }],
      },
      {
        prop: 'disable_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }],
      },
      {
        // Valid values warn (e.g. zero-layer) but produce no errors.
        prop: 'collision_layer',
        valid: [0, 1, 100, 1048575],
        acceptMode: 'no-error',
        invalid: [
          { value: -1, contains: ['between 0 and 1048575'] },
          { value: 2000000, contains: ['between 0 and 1048575'] },
        ],
      },
      {
        prop: 'collision_mask',
        valid: [0, 1, 255, 1048575],
        acceptMode: 'no-error',
        invalid: [{ value: -5 }],
      },
      {
        prop: 'max_slides',
        valid: [1, 4, 6, 10],
        acceptMode: 'no-error',
        invalid: [{ value: 0, contains: ['greater than 0'] }, { value: -1 }],
      },
    ]);

    it('should warn about custom up_direction', () => {
      expectDiagnostic(
        scene(node('CharacterBody2D', { up_direction: 'Vector2(1, 0)' }), collisionShape2d),
        {
          ruleName: 'characterbody2d-non-standard-up-direction',
          severity: 'warning',
        }
      );
    });

    it('should warn about very small floor_snap_length', () => {
      expectDiagnostic(
        scene(node('CharacterBody2D', { floor_snap_length: 0.0001 }), collisionShape2d),
        {
          ruleName: 'characterbody2d-floor-snap-too-small',
          severity: 'warning',
          contains: ['may not work reliably'],
        }
      );
    });

    it('should warn about very large floor_snap_length', () => {
      expectDiagnostic(
        scene(node('CharacterBody2D', { floor_snap_length: 50 }), collisionShape2d),
        {
          ruleName: 'characterbody2d-floor-snap-too-large',
          severity: 'warning',
          contains: ['glitchy behavior'],
        }
      );
    });

    it('should warn about very large safe_margin', () => {
      expectDiagnostic(
        scene(node('CharacterBody2D', { safe_margin: 0.5 }), collisionShape2d),
        {
          ruleName: 'characterbody2d-safe-margin-too-large',
          severity: 'warning',
          contains: ['collision detection issues'],
        }
      );
    });

    it('should warn about low max_slides', () => {
      expectDiagnostic(
        scene(node('CharacterBody2D', { max_slides: 2 }), collisionShape2d),
        {
          ruleName: 'characterbody2d-max-slides-too-low',
          severity: 'warning',
          contains: ['jittery movement'],
        }
      );
    });
  });

  describe('Semantic Validation (CollisionShape2D Children)', () => {
    it('should warn when CharacterBody2D has no CollisionShape2D children', () => {
      expectDiagnostic(scene(node('CharacterBody2D')), {
        ruleName: 'characterbody2d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'CharacterBody2D',
        contains: ['no CollisionShape2D children'],
      });
    });

    it('should pass when CharacterBody2D has CollisionShape2D child', () => {
      expectNoDiagnostic(scene(node('CharacterBody2D'), collisionShape2d), {
        ruleName: 'characterbody2d-needs-collision-shape',
      });
    });

    it('should pass when CharacterBody2D has nested CollisionShape2D', () => {
      expectNoDiagnostic(
        scene(
          node('CharacterBody2D'),
          node('Node2D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape2D', {}, { parent: 'Container' })
        ),
        { ruleName: 'characterbody2d-needs-collision-shape' }
      );
    });

    it('should pass when CharacterBody2D has multiple CollisionShape2D children', () => {
      expectNoDiagnostic(
        scene(
          node('CharacterBody2D'),
          node('CollisionShape2D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape2D', {}, { name: 'Shape2', parent: '.' })
        ),
        { ruleName: 'characterbody2d-needs-collision-shape' }
      );
    });
  });

  describe('Semantic Validation (Motion Mode Settings)', () => {
    it('should warn when floor properties are set in FLOATING mode', () => {
      expectDiagnostic(
        scene(
          node('CharacterBody2D', {
            motion_mode: 1,
            floor_stop_on_slope: true,
            floor_max_angle: 0.785398,
          }),
          collisionShape2d
        ),
        {
          ruleName: 'characterbody2d-floor-props-in-floating-mode',
          severity: 'warning',
          contains: ['FLOATING', 'GROUNDED'],
        }
      );
    });

    it('should not warn when floor properties are set in GROUNDED mode', () => {
      expectNoDiagnostic(
        scene(
          node('CharacterBody2D', {
            motion_mode: 0,
            floor_stop_on_slope: true,
            floor_max_angle: 0.785398,
          }),
          collisionShape2d
        ),
        { ruleName: 'characterbody2d-floor-props-in-floating-mode' }
      );
    });

    it('should not warn when floor properties are set without explicit motion_mode (defaults to GROUNDED)', () => {
      expectNoDiagnostic(
        scene(node('CharacterBody2D', { floor_stop_on_slope: true }), collisionShape2d),
        { ruleName: 'characterbody2d-floor-props-in-floating-mode' }
      );
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0', () => {
      expectDiagnostic(scene(node('CharacterBody2D', { collision_layer: 0 }), collisionShape2d), {
        ruleName: 'characterbody2d-zero-collision-layer',
        severity: 'warning',
        nodeType: 'CharacterBody2D',
        contains: ['collision_layer set to 0'],
      });
    });

    it('should not warn when collision_layer is non-zero', () => {
      expectNoDiagnostic(scene(node('CharacterBody2D', { collision_layer: 1 }), collisionShape2d), {
        ruleName: 'characterbody2d-zero-collision-layer',
      });
    });

    it('should warn when collision_mask is 0', () => {
      expectDiagnostic(scene(node('CharacterBody2D', { collision_mask: 0 }), collisionShape2d), {
        ruleName: 'characterbody2d-zero-collision-mask',
        severity: 'warning',
        nodeType: 'CharacterBody2D',
        contains: ['collision_mask set to 0'],
      });
    });

    it('should not warn when collision_mask is non-zero', () => {
      expectNoDiagnostic(scene(node('CharacterBody2D', { collision_mask: 1 }), collisionShape2d), {
        ruleName: 'characterbody2d-zero-collision-mask',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('CharacterBody2D', {
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
          node('CharacterBody2D', {
            motion_mode: 0,
            up_direction: 'Vector2(0, -1)',
            velocity: 'Vector2(0, 0)',
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
          collisionShape2d
        )
      );
    });

    it('should handle node with minimal properties', () => {
      expectNoErrors(scene(node('CharacterBody2D'), collisionShape2d));
    });

    it('should handle scientific notation in numeric properties', () => {
      expectClean(
        scene(
          node('CharacterBody2D', {
            floor_max_angle: '7.85398e-1',
            floor_snap_length: '1.0e-1',
            safe_margin: '1e-3',
            velocity: 'Vector2(1.5e2, -2.3e1)',
          }),
          collisionShape2d
        )
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(
        scene(
          node('CharacterBody2D', {
            collision_layer: 1048575,
            collision_mask: 1048575,
            platform_floor_layers: 4294967295,
            platform_wall_layers: 4294967295,
          }),
          collisionShape2d
        )
      );
    });

    it('should handle combination of warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('CharacterBody2D', {
            motion_mode: 10,
            floor_snap_length: 50,
            collision_layer: 0,
            max_slides: 2,
          }),
          collisionShape2d
        )
      );
      // Should have at least one error (motion_mode=10 is invalid)
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      // Check that the motion_mode error is present
      const motionModeError = diagnostics.find(d => d.message.includes('motion_mode'));
      expect(motionModeError).toBeDefined();
    });

    it('should handle zero values correctly', () => {
      expectNoErrors(
        scene(
          node('CharacterBody2D', {
            floor_snap_length: 0,
            safe_margin: 0,
            platform_floor_layers: 0,
            platform_wall_layers: 0,
          }),
          collisionShape2d
        )
      );
    });

    it('should handle 2D-specific up_direction standard (0, -1)', () => {
      expectNoDiagnostic(
        scene(node('CharacterBody2D', { up_direction: 'Vector2(0, -1)' }), collisionShape2d),
        {
          ruleName: 'characterbody2d-non-standard-up-direction',
        }
      );
    });

    it('should warn about non-standard 2D up_direction', () => {
      expectDiagnostic(
        scene(node('CharacterBody2D', { up_direction: 'Vector2(0, 1)' }), collisionShape2d),
        {
          ruleName: 'characterbody2d-non-standard-up-direction',
          severity: 'warning',
          contains: ['Vector2(0, -1)'],
        }
      );
    });
  });
});
