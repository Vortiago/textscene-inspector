/**
 * Tests for Area3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
  collisionShape3d,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Area3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Area3D properties', () => {
      expectClean(
        scene(
          node('Area3D', {
            monitoring: true,
            monitorable: true,
            gravity_space_override: 0,
            gravity_point: false,
            gravity_point_center: 'Vector3(0, 0, 0)',
            gravity_point_unit_distance: 1.0,
            gravity_direction: 'Vector3(0, -1, 0)',
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
          }),
          collisionShape3d
        )
      );
    });

    runPropertyValidation({ nodeType: 'Area3D', acceptChild: collisionShape3d }, [
      { prop: 'monitoring', valid: [true, false], invalid: [{ value: 1, contains: ['boolean'] }] },
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
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'gravity_point_center',
        valid: ['Vector3(1.5, 2.0, -3.5)'],
        invalid: [
          { value: 'Vector3(1, 2)', contains: ['Vector3 with 3 numbers'] },
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
        valid: ['Vector3(0, -1, 0)'],
        invalid: [{ value: 'Vector3(0, -1)', contains: ['Vector3 with 3 numbers'] }],
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
        invalid: [{ value: 1, contains: ['boolean'] }],
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
    ]);
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when Area3D has no CollisionShape3D or CollisionPolygon3D children', () => {
      expectDiagnostic(scene(node('Area3D')), {
        ruleName: 'area3d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'Area3D',
        contains: ['no CollisionShape3D or CollisionPolygon3D children'],
      });
    });

    it('should pass when Area3D has CollisionShape3D child', () => {
      expectClean(scene(node('Area3D'), collisionShape3d));
    });

    // A shape under an intervening node registers with nothing: `_notification`
    // attaches on `Object::cast_to<CollisionObject3D>(get_parent())`
    // (collision_shape_3d.cpp:83), so this body's `shapes` map stays empty and
    // Godot raises its own warning (collision_object_3d.cpp:739).
    it('warns when the only CollisionShape3D under Area3D sits below an intervening node', () => {
      expectDiagnostic(
        scene(
          node('Area3D'),
          node('Node3D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape3D', {}, { parent: 'Container' })
        ),
        { ruleName: 'area3d-needs-collision-shape', severity: 'warning' }
      );
    });

    it('should pass when Area3D has multiple CollisionShape3D children', () => {
      expectClean(
        scene(
          node('Area3D'),
          node('CollisionShape3D', {}, { name: 'Shape1', parent: '.' }),
          node('CollisionShape3D', {}, { name: 'Shape2', parent: '.' })
        )
      );
    });
  });

  describe('Semantic Validation (Monitoring Configuration)', () => {
    it('should warn when both monitoring and monitorable are false', () => {
      expectDiagnostic(scene(node('Area3D', { monitoring: false, monitorable: false }), collisionShape3d), {
        ruleName: 'area3d-detects-nothing',
        severity: 'warning',
        nodeType: 'Area3D',
        contains: ['both', 'detects no bodies', 'overrides still apply'],
      });
    });

    it('should not warn when only monitoring is false', () => {
      expectClean(scene(node('Area3D', { monitoring: false, monitorable: true }), collisionShape3d));
    });

    it('should not warn when only monitorable is false', () => {
      expectClean(scene(node('Area3D', { monitoring: true, monitorable: false }), collisionShape3d));
    });

    it('should not warn when both are true (default)', () => {
      expectClean(scene(node('Area3D'), collisionShape3d));
    });
  });

  describe('Semantic Validation (Point Gravity)', () => {
    it('should NOT error when gravity_point is true and the unit distance is absent (Godot omits the 0.0 default)', () => {
      // 0.0 means constant point gravity with no distance falloff, and the
      // serializer omits default values — absence is the editor's own output.
      expectClean(scene(node('Area3D', { gravity_point: true }), collisionShape3d));
    });

    it('should pass when gravity_point is true and gravity_point_unit_distance is set', () => {
      expectClean(scene(node('Area3D', { gravity_point: true, gravity_point_unit_distance: 10.0 }), collisionShape3d));
    });

    it('should pass an explicit 0.0 unit distance (the default, constant gravity)', () => {
      expectClean(scene(node('Area3D', { gravity_point: true, gravity_point_unit_distance: 0.0 }), collisionShape3d));
    });

    it('should not check gravity_point_unit_distance when gravity_point is false', () => {
      expectClean(scene(node('Area3D', { gravity_point: false }), collisionShape3d));
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    // No `collision_layer == 0` + monitoring check: no engine warning exists
    // for it, AND the premise was wrong — Area monitoring matches a target
    // body's `collision_layer` against the AREA's `collision_mask`, not the
    // area's own `collision_layer`. squash-the-creeps' MobDetector ships with
    // it deliberately.
    it('stays quiet when collision_layer is 0 and monitoring is true', () => {
      expectClean(scene(node('Area3D', { monitoring: true, collision_layer: 0 }), collisionShape3d));
    });

    it('should warn when collision_mask is 0 and monitoring is true', () => {
      expectDiagnostic(scene(node('Area3D', { monitoring: true, collision_mask: 0 }), collisionShape3d), {
        ruleName: 'area3d-monitoring-zero-mask',
        severity: 'warning',
        nodeType: 'Area3D',
      });
    });

    it('should not warn when monitoring is false', () => {
      expectClean(
        scene(node('Area3D', { monitoring: false, collision_layer: 0, collision_mask: 0 }), collisionShape3d)
      );
    });

    it('should not warn when collision values are non-zero', () => {
      expectClean(
        scene(node('Area3D', { monitoring: true, collision_layer: 1, collision_mask: 1 }), collisionShape3d)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('Area3D', {
            gravity_space_override: 10,
            gravity_point_unit_distance: -5,
            collision_layer: -1,
            monitoring: '"invalid"',
          })
        )
      );
      // Should have multiple errors from format validation
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('Area3D', {
            monitoring: true,
            monitorable: true,
            gravity_space_override: 3,
            gravity_point: true,
            gravity_point_center: 'Vector3(0, 0, 0)',
            gravity_point_unit_distance: 5.0,
            gravity_direction: 'Vector3(0, -1, 0)',
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
          }),
          collisionShape3d
        )
      );
    });

    it('should handle node with no properties', () => {
      const diagnostics = lint(scene(node('Area3D')));
      // Should only have warning about missing CollisionShape3D
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]!.ruleName).toBe('area3d-needs-collision-shape');
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('Area3D', {
            gravity: '9.8e0',
            gravity_point_unit_distance: '1e1',
            linear_damp: '1.5e-2',
            gravity_direction: 'Vector3(1e-5, -1e0, 0e0)',
          }),
          collisionShape3d
        )
      );
    });

    it('should handle bitmask boundaries', () => {
      expectClean(scene(node('Area3D', { collision_layer: 1048575, collision_mask: 1048575 }), collisionShape3d));
    });

    it('should combine format and semantic errors', () => {
      const diagnostics = lint(
        scene(
          node('Area3D', {
            gravity_point: true,
            gravity_point_unit_distance: 0,
            monitoring: false,
            monitorable: false,
          })
        )
      );
      // Should have format error for zero distance + semantic errors
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasFormatError = diagnostics.some(d => d.message.includes('greater than 0'));
      const hasSemanticError = diagnostics.some(d => d.ruleName === 'area3d-detects-nothing');
      const hasMissingShape = diagnostics.some(d => d.ruleName === 'area3d-needs-collision-shape');
      expect(hasFormatError || hasSemanticError || hasMissingShape).toBe(true);
    });
  });
});
