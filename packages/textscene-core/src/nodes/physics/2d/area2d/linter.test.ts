/**
 * Tests for Area2D linter (strict parser + semantic rules)
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

describe('Area2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Area2D properties', () => {
      expectClean(
        scene(
          node('Area2D', {
            monitoring: true,
            monitorable: true,
            gravity_space_override: 0,
            gravity_point: false,
            gravity_point_center: 'Vector2(0, 0)',
            gravity_point_unit_distance: 1.0,
            gravity_direction: 'Vector2(0, 1)',
            gravity: 9.8,
            linear_damp_space_override: 0,
            linear_damp: 0.0,
            angular_damp_space_override: 0,
            angular_damp: 0.0,
            priority: 0.0,
            audio_bus_override: false,
            audio_bus_name: '"Master"',
            collision_layer: 1,
            collision_mask: 1,
            disable_mode: 0,
          }),
          collisionShape2d
        )
      );
    });

    runPropertyValidation({ nodeType: 'Area2D', acceptChild: collisionShape2d }, [
      { prop: 'monitoring', valid: [true, false], invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }] },
      { prop: 'monitorable', valid: [true, false], invalid: [{ value: '"yes"', contains: ['boolean'] }] },
      {
        prop: 'gravity_space_override',
        valid: [0, 1, 2, 3, 4],
        invalid: [{ value: 10, contains: ['0-4'] }],
      },
      {
        prop: 'gravity_point',
        valid: [true, false],
        with: { gravity_point_unit_distance: 1.0 },
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        prop: 'gravity_point_center',
        valid: ['Vector2(1.5, 2.0)'],
        invalid: [
          { value: 'Vector2(1, 2, 3)', contains: ['Vector2 with 2 numbers'] },
          { value: 'Vector2(1)', contains: ['Vector2 with 2 numbers'] },
          { value: 1.0 },
        ],
      },
      {
        prop: 'gravity_point_unit_distance',
        // 0 is the default and legal: constant point gravity (range hint
        // "0,1024,0.001,or_greater").
        valid: [10.5, 0],
        invalid: [
          { value: -5.0, contains: ['at least 0'] },
          { value: '"far"' },
        ],
      },
      {
        prop: 'gravity_direction',
        valid: ['Vector2(0, 1)'],
        invalid: [{ value: 'Vector2(0, 1, 0)', contains: ['Vector2 with 2 numbers'] }, { value: 'Vector2(1)' }],
      },
      { prop: 'gravity', valid: [9.8, -9.8, 0.0], invalid: [{ value: '"heavy"' }] },
      {
        prop: 'linear_damp_space_override',
        valid: [0, 1, 2, 3, 4],
        invalid: [{ value: 7, contains: ['0-4'] }],
      },
      {
        prop: 'linear_damp',
        valid: [0, 0.1, 1.0, 10.5],
        invalid: [{ value: -1.0, contains: ['cannot be negative'] }, { value: '"high"' }],
      },
      {
        prop: 'angular_damp_space_override',
        valid: [0, 1, 2, 3, 4],
        invalid: [{ value: 8, contains: ['0-4'] }],
      },
      {
        prop: 'angular_damp',
        valid: [0, 0.5, 2.0, 15.0],
        invalid: [{ value: -2.0, contains: ['cannot be negative'] }],
      },
      {
        prop: 'priority',
        // An INT slot: `1.0` is whole and silent, `100.5` is truncated on the
        // way in and says so.
        valid: [0, 1.0, -1.0],
        invalid: [{ value: '"high"' }, { value: 100.5, contains: ['fractional part'] }],
      },
      {
        prop: 'audio_bus_override',
        valid: [true, false],
        with: { audio_bus_name: '"Master"' },
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      { prop: 'audio_bus_name', valid: ['"Master"', '"SFX"'] },
      {
          prop: 'collision_layer',
          valid: [1, 100, 1048575, 2000000, 2147483648, 4294967295],
          invalid: [
{ value: 4294967296, contains: ['cannot be stored in an integer slot'], severity: 'error' },
          { value: '"layer1"' },
          ],
        },
      {
          prop: 'collision_mask',
          valid: [1, 255, 1048575, 5000000, 2147483648, 4294967295],
          invalid: [
{ value: 4294967296, contains: ['cannot be stored in an integer slot'], severity: 'error' },
          ],
        },
      {
        prop: 'disable_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2', 'REMOVE'] }, { value: -1 }],
      },
    ]);
  });

  describe('Semantic Validation (CollisionShape2D Children)', () => {
    it('should warn when Area2D has no CollisionShape2D or CollisionPolygon2D children', () => {
      expectDiagnostic(scene(node('Area2D')), {
        ruleName: 'area2d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'Area2D',
        contains: ['no CollisionShape2D or CollisionPolygon2D children'],
      });
    });

    it('should pass when Area2D has CollisionShape2D child', () => {
      expectClean(scene(node('Area2D'), collisionShape2d));
    });

    // A shape under an intervening node registers with nothing: `_notification`
    // attaches on `Object::cast_to<CollisionObject2D>(get_parent())`
    // (collision_shape_2d.cpp:55), so this body's `shapes` map stays empty and
    // Godot raises its own warning (collision_object_2d.cpp:587).
    it('warns when the only CollisionShape2D under Area2D sits below an intervening node', () => {
      expectDiagnostic(
        scene(
          node('Area2D'),
          node('Node2D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape2D', {}, { parent: 'Container' })
        ),
        { ruleName: 'area2d-needs-collision-shape', severity: 'warning' }
      );
    });

    it('should pass when Area2D has multiple CollisionShape2D children', () => {
      expectClean(
        scene(
          node('Area2D'),
          node('CollisionShape2D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape2D', {}, { name: 'Shape2', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Monitoring Configuration)', () => {
    it('should warn when both monitoring and monitorable are false', () => {
      expectDiagnostic(scene(node('Area2D', { monitoring: false, monitorable: false }), collisionShape2d), {
        ruleName: 'area2d-detects-nothing',
        severity: 'warning',
        nodeType: 'Area2D',
        contains: ['both', 'detects no bodies', 'overrides still apply'],
      });
    });

    it('should not warn when only monitoring is false', () => {
      expectClean(scene(node('Area2D', { monitoring: false, monitorable: true }), collisionShape2d));
    });

    it('should not warn when only monitorable is false', () => {
      expectClean(scene(node('Area2D', { monitoring: true, monitorable: false }), collisionShape2d));
    });

    it('should not warn when both are true (default)', () => {
      expectClean(scene(node('Area2D'), collisionShape2d));
    });
  });

  describe('Semantic Validation (Point Gravity)', () => {
    it('should NOT error when gravity_point is true and the unit distance is absent (Godot omits the 0.0 default)', () => {
      // 0.0 means constant point gravity with no distance falloff, and the
      // serializer omits default values — absence is the editor's own output.
      expectClean(scene(node('Area2D', { gravity_point: true }), collisionShape2d));
    });

    it('should pass when gravity_point is true and gravity_point_unit_distance is set', () => {
      expectClean(scene(node('Area2D', { gravity_point: true, gravity_point_unit_distance: 10.0 }), collisionShape2d));
    });

    it('should pass an explicit 0.0 unit distance (the default, constant gravity)', () => {
      expectClean(scene(node('Area2D', { gravity_point: true, gravity_point_unit_distance: 0.0 }), collisionShape2d));
    });

    it('should not check gravity_point_unit_distance when gravity_point is false', () => {
      expectClean(scene(node('Area2D', { gravity_point: false }), collisionShape2d));
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    // No `collision_layer == 0` + monitoring check: no engine warning exists
    // for it, and the premise would be wrong anyway — Area monitoring matches a target
    // body's `collision_layer` against the AREA's `collision_mask`, not the
    // area's own `collision_layer`, so the area's own layer has no bearing on
    // what it detects. dodge-the-creeps' Coin ships with it deliberately.
    it('stays quiet when collision_layer is 0 and monitoring is true', () => {
      expectClean(scene(node('Area2D', { monitoring: true, collision_layer: 0 }), collisionShape2d));
    });

    it('should warn when collision_mask is 0 and monitoring is true', () => {
      expectDiagnostic(scene(node('Area2D', { monitoring: true, collision_mask: 0 }), collisionShape2d), {
        ruleName: 'area2d-monitoring-zero-mask',
        severity: 'warning',
        nodeType: 'Area2D',
      });
    });

    it('should not warn when monitoring is false', () => {
      expectClean(
        scene(node('Area2D', { monitoring: false, collision_layer: 0, collision_mask: 0 }), collisionShape2d)
      );
    });

    it('should not warn when collision values are non-zero', () => {
      expectClean(
        scene(node('Area2D', { monitoring: true, collision_layer: 1, collision_mask: 1 }), collisionShape2d)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('Area2D', {
            gravity_space_override: 10,
            gravity_point_unit_distance: -5,
            collision_layer: -1,
            monitoring: '"invalid"',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('Area2D', {
            monitoring: true,
            monitorable: true,
            gravity_space_override: 3,
            gravity_point: true,
            gravity_point_center: 'Vector2(0, 0)',
            gravity_point_unit_distance: 5.0,
            gravity_direction: 'Vector2(0, 1)',
            gravity: 9.8,
            linear_damp_space_override: 1,
            linear_damp: 0.1,
            angular_damp_space_override: 1,
            angular_damp: 0.1,
            priority: 1.0,
            audio_bus_override: true,
            audio_bus_name: '"SFX"',
            collision_layer: 1,
            collision_mask: 1,
            disable_mode: 0,
          }),
          collisionShape2d
        )
      );
    });

    it('should handle node with no properties', () => {
      const diagnostics = lint(scene(node('Area2D')));
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]!.ruleName).toBe('area2d-needs-collision-shape');
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('Area2D', {
            gravity: '9.8e0',
            gravity_point_unit_distance: '1e1',
            linear_damp: '1.5e-2',
            gravity_direction: 'Vector2(1e-5, 1e0)',
          }),
          collisionShape2d
        )
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(scene(node('Area2D', { collision_layer: 1048575, collision_mask: 1048575 }), collisionShape2d));
    });

    it('should combine format and semantic errors', () => {
      const diagnostics = lint(
        scene(
          node('Area2D', {
            gravity_point: true,
            gravity_point_unit_distance: 0,
            monitoring: false,
            monitorable: false,
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasFormatError = diagnostics.some(d => d.message.includes('greater than 0'));
      const hasSemanticError = diagnostics.some(d => d.ruleName === 'area2d-detects-nothing');
      const hasMissingShape = diagnostics.some(d => d.ruleName === 'area2d-needs-collision-shape');
      expect(hasFormatError || hasSemanticError || hasMissingShape).toBe(true);
    });

    it('should handle Vector2 with negative values', () => {
      expectClean(
        scene(
          node('Area2D', {
            gravity_direction: 'Vector2(-1, -1)',
            gravity_point_center: 'Vector2(-10.5, -20.3)',
          }),
          collisionShape2d
        )
      );
    });

    it('should handle Vector2 with whitespace variations', () => {
      expectClean(
        scene(
          node('Area2D', {
            gravity_direction: 'Vector2( 0 , 1 )',
            gravity_point_center: 'Vector2(  1.5  ,  2.5  )',
          }),
          collisionShape2d
        )
      );
    });
  });
});
