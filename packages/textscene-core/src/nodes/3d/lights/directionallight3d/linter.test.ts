/**
 * Tests for DirectionalLight3D linter (strict parser + semantic rules)
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
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('DirectionalLight3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid DirectionalLight3D properties', () => {
      expectClean(
        scene(
          node('DirectionalLight3D', {
            light_energy: '1.0',
            light_color: 'Color(1, 1, 1, 1)',
            shadow_enabled: true,
            directional_shadow_mode: 2,
          })
        )
      );
    });

    it('should accept zero light_energy', () => {
      expectClean(scene(node('DirectionalLight3D', { light_energy: 0 })));
    });

    runPropertyValidation({ nodeType: 'DirectionalLight3D' }, [
      {
        // light_3d.cpp:389 hints "0,16,0.001,or_greater" and Light3D::set_param:36
        // guards the param index, not the value, so a negative energy warns. 0 is
        // the hint's floor, 150 is above its open ceiling.
        prop: 'light_energy',
        valid: [1.5, 0, 150],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: '-1.0', contains: ['non-negative'], severity: 'warning' },
        ],
      },
      {
        prop: 'light_color',
        valid: ['Color(0.95, 0.9, 0.85, 1)'],
        invalid: [
          { value: 'RGB(1, 1, 1)', contains: ['Color'] },
          { value: 'Color(1, 1, 1)' },
        ],
      },
      {
        prop: 'light_indirect_energy',
        valid: [1.5, 0],
        invalid: [{ value: '-0.5', contains: ['non-negative'] }],
      },
      {
        prop: 'light_volumetric_fog_energy',
        valid: ['2.0'],
        invalid: [{ value: '-1.0', contains: ['non-negative'] }],
      },
      {
        prop: 'shadow_enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
      { prop: 'light_negative', valid: [true] },
      { prop: 'directional_shadow_blend_splits', valid: [true] },
      { prop: 'shadow_reverse_cull_face', valid: [false] },
      {
        prop: 'shadow_bias',
        valid: [0.1],
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      { prop: 'shadow_normal_bias', valid: ['2.0'] },
      {
        prop: 'shadow_blur',
        valid: ['5.0', 0],
        invalid: [{ value: '-1.0', contains: ['between 0 and 10'] }],
      },
      {
        // light_3d.cpp:406 hints "-16,16,0.001" (both ends closed, no
        // or_greater/or_less), so 16 is a real bound; still a warning, since
        // set_param:36 only guards the param index.
        prop: 'shadow_transmittance_bias',
        valid: [-16, -5, 0, 5, 16],
        invalid: [
          { value: -17, contains: ['between -16 and 16'] },
          { value: 17, contains: ['between -16 and 16'] },
        ],
      },
      {
        prop: 'shadow_opacity',
        valid: [0, 0.5, 1],
        invalid: [
          { value: -0.1, contains: ['between 0 and 1'] },
          { value: 1.5, contains: ['between 0 and 1'] },
        ],
      },
      {
        prop: 'directional_shadow_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }, { value: -1 }],
      },
      {
        prop: 'directional_shadow_split_1',
        invalid: [
          { value: -0.1, contains: ['between 0 and 1'] },
          { value: 1.5, contains: ['between 0 and 1'] },
        ],
      },
      {
        prop: 'directional_shadow_split_2',
        invalid: [{ value: '2.0', contains: ['between 0 and 1'] }],
      },
      {
        prop: 'directional_shadow_split_3',
        invalid: [{ value: -0.5, contains: ['between 0 and 1'] }],
      },
      {
        prop: 'directional_shadow_fade_start',
        valid: [0, 0.5, 0.8, 1],
        invalid: [{ value: 1.2, contains: ['between 0 and 1'] }],
      },
      {
        // light_3d.cpp:584 hints "0,8192,0.1,or_greater,exp", unenforced, so a
        // negative loads and only warns; 15000 is above the open ceiling.
        prop: 'directional_shadow_max_distance',
        valid: ['100.0', 0, 15000],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -100, contains: ['non-negative'], severity: 'warning' },
        ],
      },
      {
        prop: 'directional_shadow_pancake_size',
        valid: ['20.0'],
        invalid: [{ value: '-5.0', contains: ['non-negative'] }],
      },
      {
        // light_3d.cpp:397 hints "0,16,0.001,or_greater": or_greater softens the
        // 16, so 2.0 is a legal stylised boost, not an error. Only the 0 floor
        // is a real bound, and set_param:36 (index-only guard) makes it a
        // warning rather than an error.
        prop: 'light_specular',
        valid: [0, 0.5, 1, 2.0],
        invalid: [{ value: -1.0, contains: ['non-negative'] }],
      },
      {
        prop: 'light_bake_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
      {
          prop: 'light_cull_mask',
          valid: [1, 100, 1048575, 0, 2000000, 2147483648, 4294967295],
          invalid: [

          ],
        },
      {
        prop: 'sky_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
    ]);

    it('should accept valid split values (together)', () => {
      expectClean(
        scene(
          node('DirectionalLight3D', {
            directional_shadow_split_1: 0.1,
            directional_shadow_split_2: 0.2,
            directional_shadow_split_3: 0.5,
          })
        )
      );
    });

    it('should accept boundary split values', () => {
      expectClean(
        scene(
          node('DirectionalLight3D', {
            directional_shadow_split_1: 0,
            directional_shadow_split_2: 0.5,
            directional_shadow_split_3: 1,
          })
        )
      );
    });
  });

  describe('Semantic Validation', () => {
    // light_3d.cpp:389 — light_energy PROPERTY_HINT_RANGE "0,16,0.001,or_greater".
    describe('light energy warnings', () => {
      it('should warn on negative light_energy', () => {
        expectDiagnostic(scene(node('DirectionalLight3D', { light_energy: -0.005 })), {
          prop: 'light_energy',
          severity: 'warning',
          contains: ['non-negative', '-0.005'],
        });
      });

      it('should not warn above the open top of the hint', () => {
        expectNoDiagnostic(scene(node('DirectionalLight3D', { light_energy: 150 })), {
          prop: 'light_energy',
        });
      });

      it('should not warn on normal light_energy values', () => {
        expectNoDiagnostic(scene(node('DirectionalLight3D', { light_energy: 1.5 })), {
          prop: 'light_energy',
        });
      });
    });

    // Nothing enforces split ordering: the cascade consumer reads the offsets as
    // authored, and each split's own hint bounds the value, never the ordering.
    describe('shadow split ordering', () => {
      it('reports nothing whatever the order', () => {
        const cases: Record<string, number>[] = [
          { directional_shadow_split_1: 0.1, directional_shadow_split_2: 0.3, directional_shadow_split_3: 0.7 },
          { directional_shadow_split_1: 0.5, directional_shadow_split_2: 0.3 },
          { directional_shadow_split_2: 0.7, directional_shadow_split_3: 0.5 },
          { directional_shadow_split_1: 0.8, directional_shadow_split_3: 0.6 },
          { directional_shadow_split_1: 0.5, directional_shadow_split_2: 0.5 },
        ];
        for (const splits of cases) {
          expectClean(scene(node('DirectionalLight3D', splits)));
        }
      });
    });

    // light_3d.cpp:584 — directional_shadow_max_distance PROPERTY_HINT_RANGE
    // "0,8192,0.1,or_greater,exp": the high end is open, so 15000 is in band.
    describe('negative shadow distance warning', () => {
      it('should warn on negative shadow_max_distance', () => {
        expectDiagnostic(
          scene(node('DirectionalLight3D', { directional_shadow_max_distance: -1 })),
          {
            prop: 'directional_shadow_max_distance',
            severity: 'warning',
            contains: ['non-negative', '-1'],
          }
        );
      });

      it('accepts the hint floor of 0', () => {
        expectClean(scene(node('DirectionalLight3D', { directional_shadow_max_distance: 0 })));
      });

      it('should not warn above the open top of the hint', () => {
        expectNoDiagnostic(
          scene(node('DirectionalLight3D', { directional_shadow_max_distance: 15000 })),
          { prop: 'directional_shadow_max_distance' }
        );
      });

      it('should not warn on reasonable shadow_max_distance', () => {
        expectNoDiagnostic(
          scene(node('DirectionalLight3D', { directional_shadow_max_distance: 500 })),
          { prop: 'directional_shadow_max_distance' }
        );
      });
    });

    describe('shadow mode and split consistency', () => {
      it('reports if ORTHOGONAL mode has split properties', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_mode: 0,
              directional_shadow_split_1: 0.1,
            })
          ),
          {
            ruleName: 'directionallight3d-unused-splits',
            severity: 'info',
            contains: ['ORTHOGONAL', 'Splits are ignored'],
          }
        );
      });

      it('reports if PARALLEL_2_SPLITS has split_2 or split_3', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_mode: 1,
              directional_shadow_split_1: 0.1,
              directional_shadow_split_2: 0.3,
            })
          ),
          {
            ruleName: 'directionallight3d-unused-splits',
            severity: 'info',
            contains: ['PARALLEL_2_SPLITS', 'Only split_1 is used'],
          }
        );
      });

      it('should not warn for PARALLEL_4_SPLITS with all splits', () => {
        const diagnostics = lint(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_mode: 2,
              directional_shadow_split_1: 0.1,
              directional_shadow_split_2: 0.3,
              directional_shadow_split_3: 0.7,
            })
          )
        );
        const modeWarning = diagnostics.find(
          d => d.message.includes('shadow mode') && d.message.includes('split')
        );
        expect(modeWarning).toBeUndefined();
      });

      it('should not warn if no splits are set', () => {
        expectNoDiagnostic(scene(node('DirectionalLight3D', { directional_shadow_mode: 0 })), {
          prop: 'split',
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('DirectionalLight3D')));
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('DirectionalLight3D', {
            light_energy: '1.0',
            light_color: 'Color(1, 0.95, 0.9, 1)',
            light_indirect_energy: '1.0',
            light_volumetric_fog_energy: '1.0',
            shadow_enabled: true,
            shadow_bias: 0.1,
            shadow_normal_bias: '2.0',
            shadow_blur: '1.0',
            shadow_transmittance_bias: 0.5,
            shadow_opacity: '1.0',
            shadow_reverse_cull_face: false,
            directional_shadow_mode: 2,
            directional_shadow_split_1: 0.1,
            directional_shadow_split_2: 0.2,
            directional_shadow_split_3: 0.5,
            directional_shadow_fade_start: 0.8,
            directional_shadow_max_distance: '100.0',
            directional_shadow_pancake_size: '20.0',
            directional_shadow_blend_splits: true,
            light_negative: false,
            light_specular: 0.5,
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            sky_mode: 0,
          })
        )
      );
    });

    it('should report out-of-band hints as warnings, not errors', () => {
      const diagnostics = lint(
        scene(
          node('DirectionalLight3D', {
            light_energy: 0,
            directional_shadow_mode: 10,
            directional_shadow_split_1: 0.5,
            directional_shadow_split_2: 0.3,
            shadow_opacity: '2.0',
          })
        )
      );
      // light_energy = 0 is valid. directional_shadow_mode (light_3d.cpp:578)
      // and shadow_opacity (light_3d.cpp:407, via Light3D::set_param's
      // index-only guard) are both hints, not enforcement (ADR-0032), so the
      // out-of-range mode and opacity WARN instead of erroring, and nothing
      // here reaches the error tier.
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
      const warnings = diagnostics.filter((d) => d.severity === 'warning');
      const hasModeWarning = warnings.some(d => d.message.includes('directional_shadow_mode'));
      const hasOpacityWarning = warnings.some(d => d.message.includes('shadow_opacity'));
      expect(hasModeWarning && hasOpacityWarning).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('DirectionalLight3D', {
            light_energy: '1.5e0',
            shadow_bias: '1e-1',
          })
        )
      );
    });

    it('should validate mixed warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('DirectionalLight3D', {
            light_energy: -150,
            directional_shadow_max_distance: -15000,
            transform: 'Transform3D(1, 0, 0)',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasWarnings).toBe(true);
      expect(hasErrors).toBe(true);
    });
  });
});
