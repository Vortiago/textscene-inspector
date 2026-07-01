/**
 * Tests for Node2D linter (strict parser validators). Node2D registers no
 * semantic rule — it is a base class; semantic validation lives in the
 * subclasses (see index.linter.ts).
 */

import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectClean, expectDiagnostic } from '../../../linter/testing/testkit';
import './linterParser'; // Import to trigger validator registration

describe('Node2D Linter', () => {
  describe('Strict Parser Validation - Position Properties', () => {
    it('should pass validation for valid position', () => {
      expectClean(scene(node('Node2D', { position: 'Vector2(100, 50)' })));
    });

    it('should pass validation for negative position values', () => {
      expectClean(scene(node('Node2D', { position: 'Vector2(-100, -50)' })));
    });

    it('should pass validation for scientific notation in position', () => {
      expectClean(scene(node('Node2D', { position: 'Vector2(1.5e2, 2.1e-1)' })));
    });

    it('should detect invalid position format - too few values', () => {
      expectDiagnostic(scene(node('Node2D', { position: 'Vector2(100)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['position', '2 numbers'],
      });
    });

    it('should detect invalid position format - too many values', () => {
      expectDiagnostic(scene(node('Node2D', { position: 'Vector2(100, 50, 25)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['position'],
      });
    });

    it('should detect invalid position format - wrong type', () => {
      expectDiagnostic(scene(node('Node2D', { position: 'Vector3(100, 50, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['position'],
      });
    });

    it('should pass validation for valid global_position', () => {
      expectClean(scene(node('Node2D', { global_position: 'Vector2(100, 50)' })));
    });
  });

  describe('Strict Parser Validation - Rotation Properties', () => {
    it('should pass validation for valid rotation', () => {
      expectClean(scene(node('Node2D', { rotation: 1.5708 })));
    });

    it('should pass validation for negative rotation', () => {
      expectClean(scene(node('Node2D', { rotation: -1.5708 })));
    });

    it('should pass validation for zero rotation', () => {
      expectClean(scene(node('Node2D', { rotation: 0 })));
    });

    it('should detect invalid rotation format', () => {
      expectDiagnostic(scene(node('Node2D', { rotation: '"ninety degrees"' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['rotation', 'number'],
      });
    });

    it('should pass validation for valid rotation_degrees', () => {
      expectClean(scene(node('Node2D', { rotation_degrees: 90 })));
    });

    it('should pass validation for rotation_degrees with decimal', () => {
      expectClean(scene(node('Node2D', { rotation_degrees: 45.5 })));
    });

    it('should detect invalid rotation_degrees format', () => {
      expectDiagnostic(scene(node('Node2D', { rotation_degrees: 'Vector2(90, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['rotation_degrees'],
      });
    });

    it('should pass validation for valid global_rotation', () => {
      expectClean(scene(node('Node2D', { global_rotation: 3.14159 })));
    });

    it('should pass validation for valid global_rotation_degrees', () => {
      expectClean(scene(node('Node2D', { global_rotation_degrees: 180 })));
    });
  });

  describe('Strict Parser Validation - Scale Properties', () => {
    it('should pass validation for valid scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(1, 1)' })));
    });

    it('should pass validation for non-uniform scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(2, 0.5)' })));
    });

    it('should pass validation for negative scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(-1, 1)' })));
    });

    it('should detect zero scale value on x-axis', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero', 'rendering issues'],
      });
    });

    it('should detect zero scale value on y-axis', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(1, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero'],
      });
    });

    it('should detect zero scale on both axes', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero'],
      });
    });

    it('should detect extreme scale value - too large', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(10000, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'extreme', 'precision'],
      });
    });

    it('should detect extreme scale value - too small', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0.0001, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'extreme'],
      });
    });

    it('should detect invalid scale format', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', '2 numbers'],
      });
    });

    it('should pass validation for valid global_scale', () => {
      expectClean(scene(node('Node2D', { global_scale: 'Vector2(2, 2)' })));
    });
  });

  describe('Strict Parser Validation - Skew Properties', () => {
    it('should pass validation for valid skew', () => {
      expectClean(scene(node('Node2D', { skew: 0.5 })));
    });

    it('should pass validation for zero skew', () => {
      expectClean(scene(node('Node2D', { skew: 0 })));
    });

    it('should pass validation for negative skew', () => {
      expectClean(scene(node('Node2D', { skew: -0.25 })));
    });

    it('should detect invalid skew format', () => {
      expectDiagnostic(scene(node('Node2D', { skew: '"slanted"' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['skew', 'number'],
      });
    });

    it('should pass validation for valid global_skew', () => {
      expectClean(scene(node('Node2D', { global_skew: 0.3 })));
    });
  });

  describe('Strict Parser Validation - Transform Properties', () => {
    it('should pass validation for valid transform', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(1, 0, 0, 1, 0, 0)' })));
    });

    it('should pass validation for transform with translation', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(1, 0, 0, 1, 100, 50)' })));
    });

    it('should pass validation for rotated transform', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(0.707, 0.707, -0.707, 0.707, 0, 0)' })));
    });

    it('should detect invalid transform format - too few values', () => {
      expectDiagnostic(scene(node('Node2D', { transform: 'Transform2D(1, 0, 0, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['transform', '6 numbers'],
      });
    });

    it('should detect invalid transform format - wrong type', () => {
      expectDiagnostic(
        scene(node('Node2D', { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' })),
        {
          ruleName: 'strict-parser',
          severity: 'error',
          contains: ['transform'],
        }
      );
    });

    it('should pass validation for valid global_transform', () => {
      expectClean(scene(node('Node2D', { global_transform: 'Transform2D(1, 0, 0, 1, 200, 100)' })));
    });
  });

  describe('Strict Parser Validation - Z-Index Properties', () => {
    it('should pass validation for valid z_index', () => {
      expectClean(scene(node('Node2D', { z_index: 10 })));
    });

    it('should pass validation for negative z_index', () => {
      expectClean(scene(node('Node2D', { z_index: -5 })));
    });

    it('should pass validation for zero z_index', () => {
      expectClean(scene(node('Node2D', { z_index: 0 })));
    });

    it('should detect invalid z_index format - float', () => {
      expectDiagnostic(scene(node('Node2D', { z_index: 10.5 })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['z_index', 'integer'],
      });
    });

    it('should detect invalid z_index format - string', () => {
      expectDiagnostic(scene(node('Node2D', { z_index: '"ten"' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['z_index'],
      });
    });

    it('should pass validation for valid z_as_relative', () => {
      expectClean(scene(node('Node2D', { z_as_relative: true })));
    });

    it('should pass validation for z_as_relative = false', () => {
      expectClean(scene(node('Node2D', { z_as_relative: false })));
    });

    it('should detect invalid z_as_relative format', () => {
      expectDiagnostic(scene(node('Node2D', { z_as_relative: 1 })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['z_as_relative', 'boolean'],
      });
    });
  });

  describe('Strict Parser Validation - Y-Sort Properties', () => {
    it('should pass validation for valid y_sort_enabled', () => {
      expectClean(scene(node('Node2D', { y_sort_enabled: true })));
    });

    it('should pass validation for y_sort_enabled = false', () => {
      expectClean(scene(node('Node2D', { y_sort_enabled: false })));
    });

    it('should detect invalid y_sort_enabled format', () => {
      expectDiagnostic(scene(node('Node2D', { y_sort_enabled: 'yes' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['y_sort_enabled', 'boolean'],
      });
    });
  });

  describe('Combined Properties Validation', () => {
    it('should pass validation for node with multiple valid properties', () => {
      expectClean(
        scene(
          node('Node2D', {
            position: 'Vector2(100, 50)',
            rotation_degrees: 45,
            scale: 'Vector2(2, 2)',
            skew: 0.1,
            z_index: 5,
            z_as_relative: true,
            y_sort_enabled: false,
          })
        )
      );
    });

    it('should detect multiple errors in a single node', () => {
      const diagnostics = lint(
        scene(
          node('Node2D', {
            position: 'Vector2(100)',
            scale: 'Vector2(0, 1)',
            z_index: 5.5,
            y_sort_enabled: 'maybe',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThanOrEqual(4);
      expect(diagnostics.some(d => d.message.includes('position'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('z_index'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('y_sort_enabled'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes without any transform properties', () => {
      expectClean(scene(node('Node2D')));
    });

    it('should handle very small valid scale values', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(0.01, 0.01)' })));
    });

    it('should handle very large valid scale values', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(100, 100)' })));
    });

    it('should handle extreme rotation values', () => {
      expectClean(scene(node('Node2D', { rotation: 6.28318, rotation_degrees: 720 })));
    });

    it('should handle scientific notation in transform', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(1e0, 0e0, 0e0, 1e0, 1e2, 5e1)' })));
    });

    it('should handle Node2D properties on subclasses (e.g., Sprite2D)', () => {
      // Should catch the zero scale error
      expectDiagnostic(scene(node('Node2D', { position: 'Vector2(50, 50)', scale: 'Vector2(0, 1)' })), {
        prop: 'scale',
      });
    });

    it('should handle large z_index values', () => {
      expectClean(scene(node('Node2D', { z_index: 999999 })));
    });

    it('should handle very small negative z_index', () => {
      expectClean(scene(node('Node2D', { z_index: -999999 })));
    });
  });

  describe('Scale Boundary Testing', () => {
    it('should pass for scale exactly at lower threshold', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(0.001, 0.001)' })));
    });

    it('should pass for scale exactly at upper threshold', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(1000, 1000)' })));
    });

    it('should fail for scale just below lower threshold', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0.0009, 1)' })), {
        contains: ['extreme'],
      });
    });

    it('should fail for scale just above upper threshold', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(1001, 1)' })), {
        contains: ['extreme'],
      });
    });
  });
});
