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
            space_override: 0,
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
        prop: 'space_override',
        valid: [0, 1, 2, 3, 4],
        invalid: [{ value: 5, contains: ['0-4', 'DISABLED'] }, { value: -1 }],
      },
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
        valid: [10.5],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -5.0, contains: ['greater than 0'] },
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
      { prop: 'priority', valid: [0, 1.0, -1.0, 100.5], invalid: [{ value: '"high"' }] },
      {
        prop: 'audio_bus_override',
        valid: [true, false],
        with: { audio_bus_name: '"Master"' },
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      { prop: 'audio_bus_name', valid: ['"Master"', '"SFX"'] },
      {
        prop: 'collision_layer',
        valid: [1, 100, 1048575],
        invalid: [
          { value: -1, contains: ['between 0 and 1048575'] },
          { value: 2000000, contains: ['between 0 and 1048575'] },
          { value: '"layer1"' },
        ],
      },
      {
        prop: 'collision_mask',
        valid: [1, 255, 1048575],
        invalid: [
          { value: -5, contains: ['between 0 and 1048575'] },
          { value: 5000000, contains: ['between 0 and 1048575'] },
        ],
      },
    ]);
  });

  describe('Semantic Validation (CollisionShape3D Children)', () => {
    it('should warn when Area3D has no CollisionShape3D children', () => {
      expectDiagnostic(scene(node('Area3D')), {
        ruleName: 'area3d-needs-collision-shape',
        severity: 'warning',
        nodeType: 'Area3D',
        contains: ['no CollisionShape3D children'],
      });
    });

    it('should pass when Area3D has CollisionShape3D child', () => {
      expectClean(scene(node('Area3D'), collisionShape3d));
    });

    it('should pass when Area3D has nested CollisionShape3D', () => {
      expectClean(
        scene(
          node('Area3D'),
          node('Node3D', {}, { name: 'Container', parent: '.' }),
          node('CollisionShape3D', {}, { parent: 'Container' })
        )
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
        ruleName: 'area3d-inactive',
        severity: 'warning',
        nodeType: 'Area3D',
        contains: ['both', 'cannot detect'],
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
    it('should error when gravity_point is true but gravity_point_unit_distance is not set', () => {
      expectDiagnostic(scene(node('Area3D', { gravity_point: true }), collisionShape3d), {
        ruleName: 'area3d-point-gravity-missing-distance',
        severity: 'error',
        nodeType: 'Area3D',
        contains: ['gravity_point_unit_distance', 'required'],
      });
    });

    it('should pass when gravity_point is true and gravity_point_unit_distance is set', () => {
      expectClean(scene(node('Area3D', { gravity_point: true, gravity_point_unit_distance: 10.0 }), collisionShape3d));
    });

    it('should not check gravity_point_unit_distance when gravity_point is false', () => {
      expectClean(scene(node('Area3D', { gravity_point: false }), collisionShape3d));
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('should warn when collision_layer is 0 and monitoring is true', () => {
      expectDiagnostic(scene(node('Area3D', { monitoring: true, collision_layer: 0 }), collisionShape3d), {
        ruleName: 'area3d-monitoring-zero-layer',
        severity: 'warning',
        nodeType: 'Area3D',
      });
    });

    it('should warn when collision_mask is 0 and monitoring is true', () => {
      expectDiagnostic(scene(node('Area3D', { monitoring: true, collision_mask: 0 }), collisionShape3d), {
        ruleName: 'area3d-monitoring-zero-mask',
        severity: 'warning',
        nodeType: 'Area3D',
      });
    });

    it('should warn when both collision_layer and collision_mask are 0 with monitoring', () => {
      expectDiagnostic(
        scene(node('Area3D', { monitoring: true, collision_layer: 0, collision_mask: 0 }), collisionShape3d),
        { ruleName: 'area3d-monitoring-no-collision', severity: 'warning', nodeType: 'Area3D' }
      );
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

  describe('Semantic Validation (Audio Bus)', () => {
    it('should warn when audio_bus_override is true but audio_bus_name is not set', () => {
      expectDiagnostic(scene(node('Area3D', { audio_bus_override: true }), collisionShape3d), {
        ruleName: 'area3d-audio-override-missing-name',
        severity: 'warning',
        nodeType: 'Area3D',
        contains: ['audio_bus_name'],
      });
    });

    it('should pass when audio_bus_override is true and audio_bus_name is set', () => {
      expectClean(scene(node('Area3D', { audio_bus_override: true, audio_bus_name: '"Master"' }), collisionShape3d));
    });

    it('should not check audio_bus_name when audio_bus_override is false', () => {
      expectClean(scene(node('Area3D', { audio_bus_override: false }), collisionShape3d));
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('Area3D', {
            space_override: 10,
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
            space_override: 3,
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
      expect(diagnostics[0].ruleName).toBe('area3d-needs-collision-shape');
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
      const hasSemanticError = diagnostics.some(d => d.ruleName === 'area3d-inactive');
      const hasMissingShape = diagnostics.some(d => d.ruleName === 'area3d-needs-collision-shape');
      expect(hasFormatError || hasSemanticError || hasMissingShape).toBe(true);
    });
  });
});
