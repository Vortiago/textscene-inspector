/**
 * Tests for PathFollow3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  type PropValue,
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A Curve3D sub-resource so the Path3D parent lints clean. */
const curveSub = '[sub_resource type="Curve3D" id="curve_1"]';
/** The Path3D parent node that PathFollow3D must hang off of. */
const path = node('Path3D', { curve: 'SubResource("curve_1")' }, { name: 'Path' });
/** Build the PathFollow3D node under test, parented to the root Path3D. */
const follow = (props: Record<string, PropValue> = {}) =>
  node('PathFollow3D', props, { name: 'PathFollow', parent: '.' });
/** Compose a valid Path3D-parented scene around the PathFollow3D under test. */
const pathScene = (props: Record<string, PropValue> = {}) => scene(curveSub, path, follow(props));

describe('PathFollow3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid PathFollow3D properties', () => {
      expectClean(
        pathScene({
          progress: '0.0',
          h_offset: '0.0',
          v_offset: '0.0',
          rotation_mode: 3,
          cubic_interp: true,
          loop: false,
          tilt_enabled: false,
          use_model_front: false,
        })
      );
    });

    describe('progress property validation', () => {
      it('should accept valid positive progress', () => {
        expectClean(pathScene({ progress: '100.5' }));
      });

      it('should accept zero progress', () => {
        expectClean(pathScene({ progress: '0.0' }));
      });

      it('should reject non-numeric progress', () => {
        expectDiagnostic(pathScene({ progress: '"invalid"' }), {
          ruleName: 'strict-parser',
          contains: ['progress', 'must be a number'],
        });
      });
    });

    describe('progress_ratio property validation', () => {
      it('should accept valid progress_ratio in 0-1 range', () => {
        expectClean(pathScene({ progress_ratio: '0.5' }));
      });

      it('should accept progress_ratio at boundaries', () => {
        expectClean(pathScene({ progress_ratio: '1.0' }));
      });

      it('should reject non-numeric progress_ratio', () => {
        expectDiagnostic(pathScene({ progress_ratio: '"half"' }), {
          prop: 'progress_ratio',
          contains: ['must be a number'],
        });
      });
    });

    describe('offset properties validation', () => {
      it('should accept valid h_offset', () => {
        expectClean(pathScene({ h_offset: '2.5' }));
      });

      it('should accept valid v_offset', () => {
        expectClean(pathScene({ v_offset: '-1.5' }));
      });

      it('should reject non-numeric h_offset', () => {
        expectDiagnostic(pathScene({ h_offset: '"invalid"' }), {
          prop: 'h_offset',
          contains: ['must be a number'],
        });
      });

      it('should reject non-numeric v_offset', () => {
        expectDiagnostic(pathScene({ v_offset: '"invalid"' }), {
          prop: 'v_offset',
          contains: ['must be a number'],
        });
      });
    });

    describe('rotation_mode property validation', () => {
      it('should accept ROTATION_NONE (0)', () => {
        expectClean(pathScene({ rotation_mode: 0 }));
      });

      it('should accept ROTATION_Y (1)', () => {
        expectClean(pathScene({ rotation_mode: 1 }));
      });

      it('should accept ROTATION_XY (2)', () => {
        expectClean(pathScene({ rotation_mode: 2 }));
      });

      it('should accept ROTATION_XYZ (3)', () => {
        expectClean(pathScene({ rotation_mode: 3 }));
      });

      it('should accept ROTATION_ORIENTED (4)', () => {
        // Should have warning about up_vector requirement, but format is valid
        expectNoErrors(pathScene({ rotation_mode: 4 }), { ruleName: 'strict-parser' });
      });

      it('should reject invalid rotation_mode value (5)', () => {
        expectDiagnostic(pathScene({ rotation_mode: 5 }), {
          ruleName: 'strict-parser',
          contains: ['rotation_mode', '0-4'],
        });
      });

      it('should reject invalid rotation_mode value (-1)', () => {
        expectDiagnostic(pathScene({ rotation_mode: -1 }), {
          prop: 'rotation_mode',
          contains: ['0-4'],
        });
      });

      it('should reject non-numeric rotation_mode', () => {
        expectDiagnostic(pathScene({ rotation_mode: '"Y"' }), {
          prop: 'rotation_mode',
          contains: ['must be a number'],
        });
      });
    });

    describe('boolean properties validation', () => {
      it('should accept cubic_interp = true', () => {
        expectClean(pathScene({ cubic_interp: true }));
      });

      it('should accept cubic_interp = false', () => {
        expectClean(pathScene({ cubic_interp: false }));
      });

      it('should reject non-boolean cubic_interp', () => {
        expectDiagnostic(pathScene({ cubic_interp: 1 }), {
          prop: 'cubic_interp',
          contains: ['boolean'],
        });
      });

      it('should accept loop = true', () => {
        expectClean(pathScene({ loop: true }));
      });

      it('should reject non-boolean loop', () => {
        expectDiagnostic(pathScene({ loop: '"yes"' }), {
          prop: 'loop',
          contains: ['boolean'],
        });
      });

      it('should accept tilt_enabled = true', () => {
        expectClean(pathScene({ tilt_enabled: true }));
      });

      it('should reject non-boolean tilt_enabled', () => {
        expectDiagnostic(pathScene({ tilt_enabled: 1 }), {
          prop: 'tilt_enabled',
          contains: ['boolean'],
        });
      });

      it('should accept use_model_front = true', () => {
        expectClean(pathScene({ use_model_front: true }));
      });

      it('should reject non-boolean use_model_front', () => {
        expectDiagnostic(pathScene({ use_model_front: '"true"' }), {
          prop: 'use_model_front',
          contains: ['boolean'],
        });
      });
    });
  });

  describe('Semantic Validation (Parent Validation)', () => {
    it('should pass when parent is Path3D', () => {
      expectClean(pathScene({ progress: '0.0' }));
    });

    it('should error when PathFollow3D has no parent', () => {
      const parentError = expectDiagnostic(
        scene(node('PathFollow3D', { progress: '0.0' }, { name: 'PathFollow' })),
        {
          ruleName: 'pathfollow3d-no-parent',
          severity: 'error',
          nodeType: 'PathFollow3D',
          contains: ['no parent', 'MUST be a direct child of a Path3D'],
        }
      );
      expect(parentError.nodeName).toBe('PathFollow');
    });

    it('should error when parent is not Path3D', () => {
      const parentError = expectDiagnostic(
        scene(
          node('Node3D', {}, { name: 'Node3D' }),
          node('PathFollow3D', { progress: '0.0' }, { name: 'PathFollow', parent: '.' })
        ),
        {
          ruleName: 'pathfollow3d-invalid-parent',
          severity: 'error',
          nodeType: 'PathFollow3D',
          contains: ['Node3D', 'MUST be a direct child of a Path3D'],
        }
      );
      expect(parentError.nodeName).toBe('PathFollow');
    });

    it('should error when parent is MeshInstance3D', () => {
      expectDiagnostic(
        scene(
          '[sub_resource type="BoxMesh" id="mesh_1"]',
          node('MeshInstance3D', { mesh: 'SubResource("mesh_1")' }, { name: 'Mesh' }),
          node('PathFollow3D', { progress: '0.0' }, { name: 'PathFollow', parent: '.' })
        ),
        { ruleName: 'pathfollow3d-invalid-parent', contains: ['MeshInstance3D'] }
      );
    });
  });

  describe('Semantic Validation (Progress Values)', () => {
    it('should warn when progress is negative', () => {
      const warning = expectDiagnostic(pathScene({ progress: '-5.0' }), {
        ruleName: 'pathfollow3d-negative-progress',
        severity: 'warning',
        nodeType: 'PathFollow3D',
        contains: ['negative', 'clamp'],
      });
      expect(warning.nodeName).toBe('PathFollow');
    });

    it('should not warn when progress is zero', () => {
      expectNoDiagnostic(pathScene({ progress: '0.0' }), {
        ruleName: 'pathfollow3d-negative-progress',
      });
    });

    it('should not warn when progress is positive', () => {
      expectNoDiagnostic(pathScene({ progress: '100.5' }), {
        ruleName: 'pathfollow3d-negative-progress',
      });
    });

    it('should warn when progress_ratio is below 0', () => {
      const warning = expectDiagnostic(pathScene({ progress_ratio: '-0.5' }), {
        ruleName: 'pathfollow3d-progress-ratio-out-of-range',
        severity: 'warning',
        nodeType: 'PathFollow3D',
        contains: ['outside the 0-1 range'],
      });
      expect(warning.nodeName).toBe('PathFollow');
    });

    it('should warn when progress_ratio is above 1', () => {
      expectDiagnostic(pathScene({ progress_ratio: '1.5' }), {
        ruleName: 'pathfollow3d-progress-ratio-out-of-range',
        contains: ['outside the 0-1 range'],
      });
    });

    it('should not warn when progress_ratio is exactly 0', () => {
      expectNoDiagnostic(pathScene({ progress_ratio: '0.0' }), {
        ruleName: 'pathfollow3d-progress-ratio-out-of-range',
      });
    });

    it('should not warn when progress_ratio is exactly 1', () => {
      expectNoDiagnostic(pathScene({ progress_ratio: '1.0' }), {
        ruleName: 'pathfollow3d-progress-ratio-out-of-range',
      });
    });

    it('should not warn when progress_ratio is in valid range', () => {
      expectNoDiagnostic(pathScene({ progress_ratio: '0.5' }), {
        ruleName: 'pathfollow3d-progress-ratio-out-of-range',
      });
    });
  });

  describe('Semantic Validation (Conflicting Properties)', () => {
    it('should warn when both progress and progress_ratio are set', () => {
      const warning = expectDiagnostic(pathScene({ progress: '50.0', progress_ratio: '0.5' }), {
        ruleName: 'pathfollow3d-both-progress-properties',
        severity: 'warning',
        nodeType: 'PathFollow3D',
        contains: ['both', 'takes precedence'],
      });
      expect(warning.nodeName).toBe('PathFollow');
    });

    it('should not warn when only progress is set', () => {
      expectNoDiagnostic(pathScene({ progress: '50.0' }), {
        ruleName: 'pathfollow3d-both-progress-properties',
      });
    });

    it('should not warn when only progress_ratio is set', () => {
      expectNoDiagnostic(pathScene({ progress_ratio: '0.5' }), {
        ruleName: 'pathfollow3d-both-progress-properties',
      });
    });
  });

  describe('Semantic Validation (Rotation Mode)', () => {
    it('should warn when rotation_mode is ORIENTED (4)', () => {
      const warning = expectDiagnostic(pathScene({ rotation_mode: 4 }), {
        ruleName: 'pathfollow3d-oriented-mode-requires-up-vector',
        severity: 'warning',
        nodeType: 'PathFollow3D',
        contains: ['ROTATION_ORIENTED', 'up_vector_enabled'],
      });
      expect(warning.nodeName).toBe('PathFollow');
    });

    it('should not warn when rotation_mode is not ORIENTED', () => {
      expectNoDiagnostic(pathScene({ rotation_mode: 3 }), {
        ruleName: 'pathfollow3d-oriented-mode-requires-up-vector',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle PathFollow3D with no properties', () => {
      // Should only have warnings about default behavior, no errors
      expectNoErrors(pathScene());
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('Node3D', {}, { name: 'InvalidParent' }),
          node(
            'PathFollow3D',
            { progress: '-10.0', progress_ratio: '2.0', rotation_mode: 4 },
            { name: 'PathFollow', parent: '.' }
          )
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);

      // Should have parent error
      const parentError = diagnostics.find(d => d.ruleName === 'pathfollow3d-invalid-parent');
      expect(parentError).toBeDefined();

      // Should have negative progress warning
      const progressWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-negative-progress');
      expect(progressWarning).toBeDefined();

      // Should have out of range progress_ratio warning
      const ratioWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(ratioWarning).toBeDefined();

      // Should have oriented mode warning
      const orientedWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-oriented-mode-requires-up-vector');
      expect(orientedWarning).toBeDefined();
    });

    it('should handle deeply nested PathFollow3D', () => {
      // Should pass - PathFollow3D has valid Path3D parent
      expectClean(
        scene(
          curveSub,
          node('Node3D', {}, { name: 'Root' }),
          node('Path3D', { curve: 'SubResource("curve_1")' }, { name: 'Path', parent: '.' }),
          node('PathFollow3D', { progress: '0.0' }, { name: 'PathFollow', parent: 'Path' })
        )
      );
    });

    it('should handle all properties set with valid values', () => {
      expectClean(
        pathScene({
          progress: '10.0',
          h_offset: '2.5',
          v_offset: '-1.0',
          rotation_mode: 2,
          cubic_interp: true,
          loop: true,
          tilt_enabled: false,
          use_model_front: true,
        })
      );
    });

    it('should handle scientific notation in progress values', () => {
      expectClean(pathScene({ progress: '1.5e2' }));
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete camera rail scene', () => {
      expectClean(
        scene(
          '[sub_resource type="Curve3D" id="camera_path"]',
          node('Node3D', {}, { name: 'Scene' }),
          node('Path3D', { curve: 'SubResource("camera_path")' }, { name: 'CameraRail', parent: '.' }),
          node(
            'PathFollow3D',
            { progress_ratio: '0.0', rotation_mode: 3, cubic_interp: true, loop: false },
            { name: 'CameraFollow', parent: 'CameraRail' }
          ),
          node('Camera3D', {}, { name: 'Camera', parent: 'CameraRail/CameraFollow' })
        )
      );
    });

    it('should validate moving platform scene', () => {
      expectClean(
        scene(
          '[sub_resource type="Curve3D" id="platform_path"]\n[sub_resource type="BoxMesh" id="platform_mesh"]',
          node('Node3D', {}, { name: 'Scene' }),
          node('Path3D', { curve: 'SubResource("platform_path")' }, { name: 'PlatformPath', parent: '.' }),
          node(
            'PathFollow3D',
            { progress: '0.0', rotation_mode: 1, loop: true, cubic_interp: true },
            { name: 'PlatformFollow', parent: 'PlatformPath' }
          ),
          node(
            'MeshInstance3D',
            { mesh: 'SubResource("platform_mesh")' },
            { name: 'Platform', parent: 'PlatformPath/PlatformFollow' }
          )
        )
      );
    });

    it('should validate patrol path with multiple followers', () => {
      expectClean(
        scene(
          '[sub_resource type="Curve3D" id="patrol_path"]',
          node('Node3D', {}, { name: 'Scene' }),
          node('Path3D', { curve: 'SubResource("patrol_path")' }, { name: 'PatrolPath', parent: '.' }),
          node(
            'PathFollow3D',
            { progress_ratio: '0.0', rotation_mode: 1, loop: true },
            { name: 'Enemy1', parent: 'PatrolPath' }
          ),
          node(
            'PathFollow3D',
            { progress_ratio: '0.5', rotation_mode: 1, loop: true },
            { name: 'Enemy2', parent: 'PatrolPath' }
          )
        )
      );
    });
  });
});
