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
          // camera_3d.cpp:725, ERR_FAIL_COND(p_fov < 1 || p_fov > 179): the setter
          // refuses, and the hint at :682 states the same 1-179, so there is no
          // advisory band left around it — every legal fov is silent.
          prop: 'fov',
          valid: [1, 10, 45, 75, 90, 120, 150, 179],
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
            // camera_3d.cpp:731 refuses `<= CMP_EPSILON`, not `<= 0`, so the
            // whole band up to 1e-5 is refused too.
            { value: 0, contains: ['0.00001'] },
            { value: -5.0, contains: ['0.00001'] },
            { value: 0.000001, contains: ['0.00001'] },
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
          // camera_3d.cpp:736 is a bare assignment, so the hint at :685
          // ("0.001,10,0.001,or_greater") only warns. `with` keeps `far` clear of
          // the cross-field near-must-be-below-far check.
          prop: 'near',
          valid: [0.1, 0.001],
          invalid: [
            { value: 'invalid', contains: ['must be a number'] },
            { value: 0.0005, severity: 'warning', contains: ['must be >= 0.001', '0.0005'] },
            { value: 0, severity: 'warning', contains: ['must be >= 0.001'] },
          ],
        },
        {
          // `or_greater` leaves the top open, so 5000 is in range.
          prop: 'near',
          valid: [5000],
          with: { far: 100000 },
        },
        {
          // camera_3d.cpp:746 is a bare assignment; hint :686 is
          // "0.01,4000,0.01,or_greater", so the top end is open.
          prop: 'far',
          valid: [100.0, 15000],
          invalid: [
            { value: 'invalid', contains: ['must be a number'] },
            { value: 0.005, severity: 'warning', contains: ['must be >= 0.01', '0.005'] },
            { value: -100.0, severity: 'warning', contains: ['must be >= 0.01'] },
          ],
        },
        {
          prop: 'far',
          valid: [0.01],
          with: { near: 0.001 },
        },
        {
          // camera_3d.h:50-52: `KeepAspect` has exactly 2 members, so "2" names
          // no constant in Godot 4.6.3. A warning, not an error
          // (camera_3d.cpp:672's hint is unenforced — set_keep_aspect_mode is a
          // bare assignment).
          prop: 'keep_aspect',
          valid: [0, 1],
          invalid: [
            { value: 2, contains: ['0-1'] },
            { value: 5, contains: ['0-1'] },
          ],
        },
        {
          prop: 'cull_mask',
          valid: [1, 100, 1048575, 0, 2000000, 2147483648, 4294967295],
          invalid: [

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
      it('should NOT error when fov is missing for PERSPECTIVE projection', () => {
        // Godot defaults fov to 75 and omits defaults when serialising, so an
        // absent key means 75, not missing.
        expectNoDiagnostic(scene(node('Camera3D', { projection: 0, near: 0.1, far: 100.0 })), {
          prop: 'fov',
        });
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

    // Each mode reaches a different `Projection` setter (camera_3d.cpp:104-114
    // stores, and `_get_camera_projection` at :272-282 builds), so each licenses
    // a different tier:
    //
    //   frustum      `ERR_FAIL_COND(p_far <= p_near)` (projection.cpp:367)
    //                refuses BOTH cells, and 4.6.3 prints that condition once
    //                per frame on such a scene — an error.
    //   perspective  returns at projection.cpp:263 when `deltaZ == 0`, BEFORE
    //                the `set_identity()` at :268 — a dropped write, and only at
    //                that cell. `near > far` merely inverts a written matrix.
    //                Rendering it prints NOTHING, and both properties keep the
    //                value written, so this is the warning tier, not the error
    //                one.
    //   orthogonal   projection.cpp:344 has no guard at all: it writes inf at
    //                :351 and says nothing. No ERR_FAIL, no clamp, no dropped
    //                write, and both hints end in `or_greater`
    //                (camera_3d.cpp:685-686) so no warning tier either. Camera3D
    //                declares no `get_configuration_warnings`, so nothing is
    //                licensed and nothing is reported.
    describe('clipping planes relationship', () => {
      /** Both clipping-plane rule names, so a split cannot make an assertion vacuous. */
      const clipping = (content: string) =>
        lint(content).filter(
          (d) =>
            d.ruleName === 'camera3d-invalid-clipping-planes' ||
            d.ruleName === 'camera3d-zero-depth-range'
        );

      it('should error when near > far under the frustum projection', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 2, size: 1.0, near: 100.0, far: 50.0 })),
          {
            prop: 'clipping',
            severity: 'error',
            nodeType: 'Camera3D',
            ruleName: 'camera3d-invalid-clipping-planes',
            contains: ['near', 'far', '100', '50', 'frustum'],
          }
        );
      });

      it('should error when near equals far under the frustum projection', () => {
        // One ERR_FAIL_COND covers both cells, so frustum reports one reason.
        expectDiagnostic(
          scene(node('Camera3D', { projection: 2, size: 1.0, near: 100.0, far: 100.0 })),
          {
            prop: 'clipping',
            severity: 'error',
            nodeType: 'Camera3D',
            ruleName: 'camera3d-invalid-clipping-planes',
            contains: ['frustum', '100'],
          }
        );
      });

      it('should not error when near < far', () => {
        expect(
          clipping(scene(node('Camera3D', { projection: 2, size: 1.0, near: 0.1, far: 100.0 })))
        ).toHaveLength(0);
      });

      // `projection` absent means PROJECTION_PERSPECTIVE (camera_3d.h:66).
      it.each([
        ['perspective, written', { projection: 0, fov: 75.0 }],
        ['perspective, defaulted by omission', { fov: 75.0 }],
        ['orthogonal', { projection: 1, size: 10.0 }],
      ])('stays silent on near > far under %s', (_label, props) => {
        // deltaZ is non-zero, so the matrix is written and merely inverted.
        expect(clipping(scene(node('Camera3D', { ...props, near: 100.0, far: 50.0 })))).toHaveLength(
          0
        );
      });

      it.each([
        ['perspective, written', { projection: 0, fov: 75.0 }],
        ['perspective, defaulted by omission', { fov: 75.0 }],
        // camera_3d.cpp:341 assigns `mode` only for 0/1/2, so an out-of-enum
        // value is dropped and the camera stays on its camera_3d.h:66 default.
        ['an out-of-enum projection, dropped back to perspective', { projection: 5, fov: 75.0 }],
      ])('warns on near == far under %s', (_label, props) => {
        expectDiagnostic(scene(node('Camera3D', { ...props, near: 100.0, far: 100.0 })), {
          prop: 'clipping',
          severity: 'warning',
          nodeType: 'Camera3D',
          ruleName: 'camera3d-zero-depth-range',
          contains: ['100', 'perspective'],
        });
      });

      it('stays silent on near == far under the orthogonal projection', () => {
        // projection.cpp:344 writes -2.0/(zfar - znear) as inf and returns. The
        // value is stored untouched and no hint end is crossed, so ADR-0032
        // licenses neither tier.
        expect(
          clipping(scene(node('Camera3D', { projection: 1, size: 10.0, near: 100.0, far: 100.0 })))
        ).toHaveLength(0);
      });

      // `inf`/`nan` are legal float literals (variant_parser.cpp:150-155), and
      // the two modes part company on them because the conditions differ.
      it('stays silent on near == far == inf under perspective, where deltaZ is nan', () => {
        // projection.cpp:260 computes `inf - inf` as nan, and `nan == 0` is
        // false, so :263 does NOT return and the matrix is written.
        expect(
          clipping(scene(node('Camera3D', { projection: 0, fov: 75.0, near: 'inf', far: 'inf' })))
        ).toHaveLength(0);
      });

      it('errors on near == far == inf under frustum, where inf <= inf still fails', () => {
        expectDiagnostic(
          scene(node('Camera3D', { projection: 2, size: 1.0, near: 'inf', far: 'inf' })),
          {
            prop: 'clipping',
            severity: 'error',
            ruleName: 'camera3d-invalid-clipping-planes',
          }
        );
      });

      it.each([
        ['frustum', { projection: 2, size: 1.0 }],
        ['perspective', { projection: 0, fov: 75.0 }],
      ])('stays silent on a nan plane under %s, where every comparison is false', (_l, props) => {
        expect(
          clipping(scene(node('Camera3D', { ...props, near: 'nan', far: 'nan' })))
        ).toHaveLength(0);
      });

      // An absent plane is Godot's default, not an absent value: camera_3d.h:72
      // is `_near = 0.05` and :73 is `_far = 4000.0`, and the serialiser omits a
      // property sitting at its default. The pair is still a pair.
      it('warns when the written far meets the defaulted near', () => {
        expectDiagnostic(scene(node('Camera3D', { projection: 0, fov: 75.0, far: 0.05 })), {
          prop: 'clipping',
          severity: 'warning',
          ruleName: 'camera3d-zero-depth-range',
          contains: ['0.05'],
        });
      });

      it('warns when the written near meets the defaulted far', () => {
        expectDiagnostic(scene(node('Camera3D', { projection: 0, fov: 75.0, near: 4000 })), {
          prop: 'clipping',
          severity: 'warning',
          ruleName: 'camera3d-zero-depth-range',
          contains: ['4000'],
        });
      });

      it('errors when a written far falls below the defaulted near under frustum', () => {
        expectDiagnostic(scene(node('Camera3D', { projection: 2, size: 1.0, far: 0.04 })), {
          prop: 'clipping',
          severity: 'error',
          ruleName: 'camera3d-invalid-clipping-planes',
          contains: ['0.05', '0.04'],
        });
      });

      it.each([
        ['both defaulted', {}],
        ['near written, far defaulted', { near: 0.1 }],
        ['far written, near defaulted', { far: 1000.0 }],
      ])('stays silent when the defaults keep the range open: %s', (_label, props) => {
        expect(clipping(scene(node('Camera3D', { projection: 0, fov: 75.0, ...props })))).toHaveLength(
          0
        );
      });
    });

    describe('fov carries no advisory', () => {
      // camera_3d.cpp:725 ERR_FAILs outside 1-179 and the hint at :682 states the
      // same bounds, so the only fov diagnostic is that error — no warning band.
      it.each([1, 10, 45, 75, 90, 150, 179])('says nothing about fov %s', (fov) => {
        expectNoDiagnostic(
          scene(node('Camera3D', { projection: 0, fov, near: 0.1, far: 100.0 })),
          { prop: 'field of view' }
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle Camera3D with no properties (defaults)', () => {
      // Every property defaults, so a bare camera is valid and silent.
      expectClean(scene(node('Camera3D')));
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
      // Errors for projection (silently-dropped write, camera_3d.cpp:341) and
      // fov (ERR_FAIL_COND, :725). near = -0.1, far = 0, keep_aspect = 10 and
      // doppler_tracking = 5 are all warnings: their setters are bare
      // assignments (camera_3d.cpp:736/:746/:586-591/:597-605).
      expect(diagnostics.length).toBeGreaterThan(3);
      expect(diagnostics.some(d => d.message.includes('projection'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('fov'))).toBe(true);
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
      // Test case 1: Only warnings (values below their hints)
      let diagnostics = lint(
        scene(node('Camera3D', { projection: 0, fov: 10, near: 0.0005, far: 0.005 }))
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
      // camera_3d.cpp:725 accepts exactly 1 and 179.
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
        scene(node('Camera3D', { projection: 0, fov: 10, near: 0.0005, far: 0.005 }))
      );
      // Both clipping planes sit below their hinted floors; fov 10 is legal and
      // silent, and the pair itself is ordered so the cross-field rule says
      // nothing.
      expect(diagnostics.map(d => d.message).sort()).toEqual([
        "Property 'far' must be >= 0.01, got: 0.005",
        "Property 'near' must be >= 0.001, got: 0.0005",
      ]);
      expect(diagnostics.every(d => d.severity === 'warning')).toBe(true);
    });

    it('should handle clipping planes at exact boundary (near = far boundary)', () => {
      // `<=`, not `<`: projection.cpp:367 is `ERR_FAIL_COND(p_far <= p_near)`.
      expectDiagnostic(
        scene(node('Camera3D', { projection: 2, size: 1.0, near: 0.1, far: 0.1 })),
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
