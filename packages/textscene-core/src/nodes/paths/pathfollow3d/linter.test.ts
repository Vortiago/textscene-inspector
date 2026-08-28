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

/**
 * The same scene, but with the parent's curve explicitly opting OUT of up
 * vectors — the only state in which Godot's ROTATION_ORIENTED warning fires
 * (path_3d.cpp:362). `curveSub` above omits the key, and the default is `true`
 * (curve.h:299), so the ordinary scene must stay silent about that mode.
 */
const noUpVectorCurve = '[sub_resource type="Curve3D" id="curve_1"]\nup_vector_enabled = false';
const noUpVectorScene = (props: Record<string, PropValue> = {}) =>
  scene(noUpVectorCurve, path, follow(props));

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
      // No "accepts a valid ratio" case: there is no such thing in a scene
      // file. Every stored progress_ratio is dropped, and the semantic rule
      // below reports all of them; only the FORMAT check lives here.
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
          contains: ['converts'],
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
          contains: ['converts'],
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

    it('should warn when PathFollow3D has no parent', () => {
      // Advisory, not an error: Godot raises this as a configuration warning
      // (path_3d.cpp:359) and the file itself is perfectly well-formed.
      const parentError = expectDiagnostic(
        scene(node('PathFollow3D', { progress: '0.0' }, { name: 'PathFollow' })),
        {
          ruleName: 'pathfollow3d-no-parent',
          severity: 'warning',
          nodeType: 'PathFollow3D',
          contains: ['the scene root', 'direct child of a Path3D'],
        }
      );
      expect(parentError.nodeName).toBe('PathFollow');
    });

    it('should warn when parent is not Path3D', () => {
      const parentError = expectDiagnostic(
        scene(
          node('Node3D', {}, { name: 'Node3D' }),
          node('PathFollow3D', { progress: '0.0' }, { name: 'PathFollow', parent: '.' })
        ),
        {
          ruleName: 'pathfollow3d-invalid-parent',
          severity: 'warning',
          nodeType: 'PathFollow3D',
          contains: ['a child of a Node3D node', 'direct child of a Path3D'],
        }
      );
      expect(parentError.nodeName).toBe('PathFollow');
    });

    // path_3d.cpp:357 wraps both of this override's warnings in
    // `is_visible_in_tree() && is_inside_tree()`.
    describe('the visibility gate', () => {
      it('stays quiet when the node itself is hidden', () => {
        expectNoDiagnostic(
          scene(
            node('Node3D', {}, { name: 'Node3D' }),
            node('PathFollow3D', { visible: false }, { name: 'PathFollow', parent: '.' })
          ),
          { ruleName: 'pathfollow3d-invalid-parent' }
        );
      });

      it('stays quiet at the scene root when hidden', () => {
        expectNoDiagnostic(scene(node('PathFollow3D', { visible: false }, { name: 'PathFollow' })), {
          ruleName: 'pathfollow3d-no-parent',
        });
      });

      it('stays quiet when a Node3D ancestor is hidden', () => {
        expectNoDiagnostic(
          scene(
            node('Node3D', { visible: false }, { name: 'Root' }),
            node('Node3D', {}, { name: 'Mid', parent: '.' }),
            node('PathFollow3D', {}, { name: 'PathFollow', parent: 'Mid' })
          ),
          { ruleName: 'pathfollow3d-invalid-parent' }
        );
      });

      it('still warns when a plain Node breaks the Node3D chain below the hidden ancestor', () => {
        expectDiagnostic(
          scene(
            node('Node3D', { visible: false }, { name: 'Root' }),
            node('Node', {}, { name: 'Plain', parent: '.' }),
            node('PathFollow3D', {}, { name: 'PathFollow', parent: 'Plain' })
          ),
          { ruleName: 'pathfollow3d-invalid-parent', severity: 'warning' }
        );
      });

      it('stays quiet about ROTATION_ORIENTED when hidden', () => {
        expectNoDiagnostic(
          scene(
            noUpVectorCurve,
            path,
            node('PathFollow3D', { rotation_mode: '4', visible: false }, { name: 'PathFollow', parent: '.' })
          ),
          { ruleName: 'pathfollow3d-oriented-mode-requires-up-vector' }
        );
      });
    });

    it('should warn when parent is MeshInstance3D', () => {
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

    it('stays silent on a non-finite progress, which the setter refuses outright', () => {
      // path_3d.cpp:450 opens `set_progress` with
      // ERR_FAIL_COND(!std::isfinite(p_progress)), so nothing is stored and
      // there is no clamped travel to describe.
      for (const spelling of ['inf_neg', '-inf', 'nan']) {
        expectNoDiagnostic(pathScene({ progress: spelling }), {
          ruleName: 'pathfollow3d-negative-progress',
        });
      }
    });

    it('still warns on a negative progress spelled with an exponent', () => {
      expectDiagnostic(pathScene({ progress: '-2e1' }), {
        ruleName: 'pathfollow3d-negative-progress',
        severity: 'warning',
      });
    });

    it('errors on progress_ratio at every value, in range or not', () => {
      // The range is beside the point. `set_progress_ratio` opens with
      // ERR_FAIL_NULL_MSG(path) (path_3d.cpp:503) and `path` is bound on
      // enter-tree, which is after the loader applies properties — so a
      // textbook 0.5 is dropped exactly as -0.5 and 1.5 are.
      for (const ratio of ['-0.5', '0.0', '0.5', '1.0', '1.5']) {
        const report = expectDiagnostic(pathScene({ progress_ratio: ratio }), {
          ruleName: 'pathfollow3d-progress-ratio-ignored',
          severity: 'error',
          nodeType: 'PathFollow3D',
          contains: ["Use 'progress' instead"],
        });
        expect(report.nodeName).toBe('PathFollow');
      }
    });

    it('still errors when progress is authored alongside it, since progress wins', () => {
      expectDiagnostic(pathScene({ progress: '50.0', progress_ratio: '0.5' }), {
        ruleName: 'pathfollow3d-progress-ratio-ignored',
        severity: 'error',
      });
    });

    it('says nothing about progress_ratio when the file never mentions it', () => {
      expectNoDiagnostic(pathScene({ progress: '50.0' }), {
        ruleName: 'pathfollow3d-progress-ratio-ignored',
      });
    });
  });

  describe('Semantic Validation (Rotation Mode)', () => {
    it('stays quiet on ORIENTED when the curve keeps its default up vectors', () => {
      expectNoDiagnostic(pathScene({ rotation_mode: 4 }), {
        ruleName: 'pathfollow3d-oriented-mode-requires-up-vector',
      });
    });

    it('warns on ORIENTED only when the parent curve disables up vectors', () => {
      const warning = expectDiagnostic(noUpVectorScene({ rotation_mode: 4 }), {
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

    it('reports every independent problem at once', () => {
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

      // Should have the dropped-progress_ratio error
      const ratioReport = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-ignored');
      expect(ratioReport).toBeDefined();

      // But NOT the oriented-mode warning. Godot's ROTATION_ORIENTED check sits
      // in the `else` branch of the parent test (path_3d.cpp:360-365), so a node
      // that failed the parent test never reaches it — and with no Path3D there
      // is no curve to ask about up vectors anyway.
      const orientedWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-oriented-mode-requires-up-vector');
      expect(orientedWarning).toBeUndefined();
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
            { progress: '0.0', rotation_mode: 3, cubic_interp: true, loop: false },
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
            { progress: '0.0', rotation_mode: 1, loop: true },
            { name: 'Enemy1', parent: 'PatrolPath' }
          ),
          node(
            'PathFollow3D',
            { progress: '5.0', rotation_mode: 1, loop: true },
            { name: 'Enemy2', parent: 'PatrolPath' }
          )
        )
      );
    });
  });
});
