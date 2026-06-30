/**
 * Tests for Camera3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Camera3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Camera3D properties with perspective projection', () => {
      expectClean(
        scene(
          node('Camera3D', {
            projection: 0,
            fov: 75.0,
            near: 0.1,
            far: 100.0,
            keep_aspect: 0,
            cull_mask: 1048575,
          }, { name: 'Camera' })
        )
      );
    });

    it('should pass validation for valid Camera3D properties with orthogonal projection', () => {
      expectClean(
        scene(
          node('Camera3D', {
            projection: 1,
            size: 10.0,
            near: 0.1,
            far: 100.0,
            keep_aspect: 1,
          }, { name: 'Camera' })
        )
      );
    });

    // Every accept-case camera is otherwise valid (perspective, sane clipping)
    // via baseProps; per-case `with` overrides where the property needs another
    // projection mode.
    runPropertyValidation(
      {
        nodeType: 'Camera3D',
        baseProps: { projection: 0, fov: 75.0, near: 0.1, far: 100.0 },
      },
      [
        {
          prop: 'projection',
          valid: [0, 1, 2],
          invalid: [
            { value: 5, contains: ['0-2'] },
            { value: 'perspective', contains: ['must be a number'] },
          ],
        },
        {
          // fov accept values include extreme degrees (1, 179) that fire a
          // separate "field of view" warning, so accept asserts only the
          // absence of *errors* (acceptMode 'no-error') rather than a clean scene.
          prop: 'fov',
          acceptMode: 'no-error',
          valid: [1, 45, 75, 90, 120, 179],
          invalid: [
            { value: 0.5, contains: ['fov', 'between 1 and 179'] },
            { value: 180, contains: ['fov', 'between 1 and 179'] },
            { value: 'invalid', contains: ['fov', 'must be a number'] },
          ],
        },
        {
          prop: 'size',
          valid: [10.0],
          with: { projection: 1 },
          invalid: [
            { value: 0, contains: ['greater than 0'] },
            { value: -5.0, contains: ['greater than 0'] },
            { value: 'invalid', contains: ['must be a number'] },
          ],
        },
        {
          prop: 'frustum_offset',
          valid: ['Vector2(0.5, -0.3)', 'Vector2(1.5e-2, -3.2e1)'],
          with: { projection: 2 },
          invalid: [
            { value: '(0.5, -0.3)', contains: ['Vector2'] },
            { value: 'Vector2(0.5, -0.3, 1.0)' },
          ],
        },
        {
          prop: 'near',
          valid: [0.1],
          invalid: [
            { value: 0, contains: ['greater than 0'] },
            { value: -0.1, contains: ['greater than 0'] },
            { value: 'invalid', contains: ['must be a number'] },
          ],
        },
        {
          prop: 'far',
          valid: [100.0],
          invalid: [
            { value: 0, contains: ['greater than 0'] },
            { value: -100.0, contains: ['greater than 0'] },
            { value: 'invalid', contains: ['must be a number'] },
          ],
        },
        {
          prop: 'keep_aspect',
          valid: [0, 1, 2],
          invalid: [{ value: 5, contains: ['0-2'] }],
        },
        {
          prop: 'cull_mask',
          valid: [1, 100, 1048575],
          invalid: [
            { value: 0, contains: ['between 1 and 1048575'] },
            { value: 2000000, contains: ['between 1 and 1048575'] },
          ],
        },
        {
          prop: 'doppler_tracking',
          valid: [0, 1, 2],
          invalid: [{ value: 5, contains: ['0-2'] }],
        },
        {
          prop: 'current',
          valid: ['true', 'false'],
          invalid: [{ value: 'yes', contains: ['boolean'] }],
        },
        {
          prop: 'h_offset',
          valid: [0.5],
          invalid: [{ value: 'invalid', contains: ['must be a number'] }],
        },
        {
          prop: 'v_offset',
          valid: [-0.25],
          invalid: [{ value: 'invalid', contains: ['must be a number'] }],
        },
      ]
    );
  });

  describe('Semantic Validation', () => {
    describe('missing required properties errors', () => {
      it('should error when fov is missing for PERSPECTIVE projection', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, near: 0.1, far: 100.0 })),
          {
            prop: 'fov',
            severity: 'error',
            nodeType: 'Camera3D',
            contains: ['requires', 'field of view'],
          }
        );
      });

      it('should NOT error when size is missing for ORTHOGONAL projection (Godot defaults to 1.0)', () => {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 1, near: 0.1, far: 100.0 })),
          { prop: 'size' }
        );
      });

      it('should not error when fov is present for default (PERSPECTIVE) projection', () => {
        expectNoDiagnostic(
          scene(node('Camera3D', { fov: 75.0, near: 0.1, far: 100.0 })),
          { prop: 'fov' }
        );
      });

      it('should not error when size is present for ORTHOGONAL projection', () => {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 1, size: 10.0, near: 0.1, far: 100.0 })),
          { prop: 'size' }
        );
      });
    });

    describe('clipping planes relationship', () => {
      it('should error when near >= far', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 100.0, far: 50.0 })),
          {
            prop: 'clipping',
            severity: 'error',
            nodeType: 'Camera3D',
            contains: ['near', 'far', '100', '50'],
          }
        );
      });

      it('should error when near equals far', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 100.0, far: 100.0 })),
          {
            prop: 'clipping',
            severity: 'error',
            nodeType: 'Camera3D',
            contains: ['must be less than'],
          }
        );
      });

      it('should not error when near < far', () => {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 0.1, far: 100.0 })),
          { prop: 'clipping' }
        );
      });
    });

    describe('near clipping plane warnings', () => {
      it('should warn when near is very small', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 0.005, far: 100.0 })),
          {
            prop: 'near',
            severity: 'warning',
            nodeType: 'Camera3D',
            contains: ['very small', '0.005', 'z-fighting'],
          }
        );
      });

      it('should not warn for normal near values', () => {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 0.1, far: 100.0 })),
          { prop: 'near' }
        );
      });
    });

    describe('far clipping plane warnings', () => {
      it('should warn when far is very large', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 0.1, far: 15000 })),
          {
            prop: 'far',
            severity: 'warning',
            nodeType: 'Camera3D',
            contains: ['very large', '15000', 'precision'],
          }
        );
      });

      it('should not warn for normal far values', () => {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 75.0, near: 0.1, far: 1000 })),
          { prop: 'far' }
        );
      });
    });

    describe('fov warnings', () => {
      it('should warn when fov is very narrow', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 10, near: 0.1, far: 100.0 })),
          {
            prop: 'field of view',
            severity: 'warning',
            nodeType: 'Camera3D',
            contains: ['very narrow', '10', 'tunnel vision'],
          }
        );
      });

      it('should warn when fov is very wide', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 0, fov: 150, near: 0.1, far: 100.0 })),
          {
            prop: 'field of view',
            severity: 'warning',
            nodeType: 'Camera3D',
            contains: ['very wide', '150', 'distortion'],
          }
        );
      });

      it('should not warn for normal fov values', () => {
        const validFovs = [45, 60, 75, 90];
        for (const fov of validFovs) {
          expectNoDiagnostic(
            scene(node('Camera3D', { projection: 0, fov, near: 0.1, far: 100.0 })),
            { prop: 'field of view' }
          );
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle Camera3D with no properties (defaults)', () => {
      // Default projection is PERSPECTIVE (0), so fov is required.
      expectDiagnostic(scene(node('Camera3D')), { prop: 'fov' });
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('Camera3D', {
            projection: 0,
            fov: 75.0,
            near: 0.1,
            far: 100.0,
            keep_aspect: 0,
            cull_mask: 1048575,
            doppler_tracking: 0,
            current: 'true',
            h_offset: 0.0,
            v_offset: 0.0,
            frustum_offset: 'Vector2(0, 0)',
          })
        )
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('Camera3D', {
            projection: 5,
            fov: 200,
            near: -0.1,
            far: 0,
            keep_aspect: 10,
            cull_mask: 0,
            doppler_tracking: 5,
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(5);
      // Should have errors for: projection, fov, near, far, keep_aspect, cull_mask, doppler_tracking
      const hasProjectionError = diagnostics.some(d => d.message.includes('projection'));
      const hasFovError = diagnostics.some(d => d.message.includes('fov'));
      const hasNearError = diagnostics.some(d => d.message.includes('near'));
      const hasFarError = diagnostics.some(d => d.message.includes('far'));
      expect(hasProjectionError || hasFovError || hasNearError || hasFarError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('Camera3D', {
            projection: 0,
            fov: '7.5e1',
            near: '1e-1',
            far: '1e2',
            h_offset: '5e-2',
            v_offset: '-3e-1',
          })
        )
      );
    });

    it('should validate mixed warnings and errors', () => {
      // Test case 1: Only warnings (extreme values)
      let diagnostics = lint(
        scene(node('Camera3D', { projection: 0, fov: 10, near: 0.005, far: 15000 }))
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarnings).toBe(true);

      // Test case 2: Errors from invalid values
      diagnostics = lint(
        scene(node('Camera3D', { projection: 5, fov: 200, near: -0.1 }))
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasErrors).toBe(true);
    });

    it('should handle boundary values for fov', () => {
      const boundaryValues = [1, 179];
      for (const fov of boundaryValues) {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 0, fov, near: 0.1, far: 100.0 })),
          { prop: 'fov' }
        );
      }
    });

    it('should handle FRUSTUM projection mode', () => {
      expectClean(
        scene(
          node('Camera3D', {
            projection: 2,
            fov: 75.0,
            frustum_offset: 'Vector2(0.5, -0.3)',
            near: 0.1,
            far: 100.0,
          })
        )
      );
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        scene(node('Camera3D', { projection: 0, fov: 10, near: 0.005, far: 15000 }))
      );
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have warnings for all extreme values
      const fovWarning = diagnostics.find(d => d.message.includes('field of view') && d.message.includes('narrow'));
      const nearWarning = diagnostics.find(d => d.message.includes('near') && d.message.includes('small'));
      const farWarning = diagnostics.find(d => d.message.includes('far') && d.message.includes('large'));
      expect(fovWarning).toBeDefined();
      expect(nearWarning).toBeDefined();
      expect(farWarning).toBeDefined();
    });

    it('should handle clipping planes at exact boundary (near = far boundary)', () => {
      expectDiagnostic(
        scene(node('Camera3D', { projection: 0, fov: 75.0, near: 0.1, far: 0.1 })),
        { prop: 'clipping', severity: 'error' }
      );
    });

    it('should handle orthogonal projection with all properties', () => {
      expectClean(
        scene(
          node('Camera3D', {
            projection: 1,
            size: 20.0,
            near: 0.1,
            far: 500.0,
            keep_aspect: 1,
            cull_mask: 524287,
            current: 'true',
            h_offset: 1.5,
            v_offset: -0.5,
          })
        )
      );
    });
  });
});
