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
        // guards the param index, not the value, so a negative energy warns.
        prop: 'light_energy',
        valid: [1.5, 0, '-1.0'],
        acceptMode: 'no-error',
        invalid: [{ value: 'invalid', contains: ['must be a number'] }],
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
        invalid: [{ value: '-1.0', contains: ['non-negative'] }],
      },
      {
        prop: 'shadow_transmittance_bias',
        valid: [-10, -5, 0, 5, 10],
        invalid: [
          { value: -11, contains: ['between -10 and 10'] },
          { value: 11, contains: ['between -10 and 10'] },
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
        // light_3d.cpp:584 hints "0,8192,0.1,or_greater", unenforced, so a negative
        // loads and only warns.
        prop: 'directional_shadow_max_distance',
        valid: ['100.0', 0, -100],
        acceptMode: 'no-error',
        invalid: [{ value: 'invalid', contains: ['must be a number'] }],
      },
      {
        prop: 'directional_shadow_pancake_size',
        valid: ['20.0'],
        invalid: [{ value: '-5.0', contains: ['non-negative'] }],
      },
      {
        prop: 'light_specular',
        valid: [0, 0.5, 1],
        invalid: [{ value: '2.0', contains: ['between 0 and 1'] }],
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
          prop: 'Light energy',
          severity: 'warning',
          contains: ['Light energy is negative', '-0.005'],
        });
      });

      it('should not warn above the open top of the hint', () => {
        expectNoDiagnostic(scene(node('DirectionalLight3D', { light_energy: 150 })), {
          prop: 'Light energy',
        });
      });

      it('should not warn on normal light_energy values', () => {
        expectNoDiagnostic(scene(node('DirectionalLight3D', { light_energy: 1.5 })), {
          prop: 'Light energy',
        });
      });
    });

    describe('shadow split ordering', () => {
      it('should pass with correctly ordered splits', () => {
        expectClean(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_split_1: 0.1,
              directional_shadow_split_2: 0.3,
              directional_shadow_split_3: 0.7,
            })
          )
        );
      });

      it('should error if split_1 >= split_2', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_split_1: 0.5,
              directional_shadow_split_2: 0.3,
            })
          ),
          {
            ruleName: 'directionallight3d-shadow-split-order',
            severity: 'error',
            contains: ['split ordering', 'split_1', 'split_2'],
          }
        );
      });

      it('should error if split_2 >= split_3', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_split_2: 0.7,
              directional_shadow_split_3: 0.5,
            })
          ),
          {
            ruleName: 'directionallight3d-shadow-split-order',
            severity: 'error',
            contains: ['split ordering', 'split_2', 'split_3'],
          }
        );
      });

      it('should error if split_1 >= split_3', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_split_1: 0.8,
              directional_shadow_split_3: 0.6,
            })
          ),
          {
            ruleName: 'directionallight3d-shadow-split-order',
            severity: 'error',
            contains: ['split ordering', 'split_1', 'split_3'],
          }
        );
      });

      it('should error if splits are equal', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_split_1: 0.5,
              directional_shadow_split_2: 0.5,
            })
          ),
          {
            ruleName: 'directionallight3d-shadow-split-order',
            severity: 'error',
            contains: ['split ordering'],
          }
        );
      });
    });

    // light_3d.cpp:584 — directional_shadow_max_distance PROPERTY_HINT_RANGE
    // "0,8192,0.1,or_greater": the high end is open, so 15000 is in band.
    describe('negative shadow distance warning', () => {
      it('should warn on negative shadow_max_distance', () => {
        expectDiagnostic(
          scene(node('DirectionalLight3D', { directional_shadow_max_distance: -1 })),
          {
            ruleName: 'directionallight3d-negative-shadow-distance',
            severity: 'warning',
            contains: ['Shadow max distance is negative', '-1'],
          }
        );
      });

      it('should not warn above the open top of the hint', () => {
        expectNoDiagnostic(
          scene(node('DirectionalLight3D', { directional_shadow_max_distance: 15000 })),
          { prop: 'Shadow max distance' }
        );
      });

      it('should not warn on reasonable shadow_max_distance', () => {
        expectNoDiagnostic(
          scene(node('DirectionalLight3D', { directional_shadow_max_distance: 500 })),
          { prop: 'Shadow max distance' }
        );
      });
    });

    describe('shadow mode and split consistency', () => {
      it('should warn if ORTHOGONAL mode has split properties', () => {
        expectDiagnostic(
          scene(
            node('DirectionalLight3D', {
              directional_shadow_mode: 0,
              directional_shadow_split_1: 0.1,
            })
          ),
          {
            ruleName: 'directionallight3d-unused-splits',
            severity: 'warning',
            contains: ['ORTHOGONAL', 'Splits are ignored'],
          }
        );
      });

      it('should warn if PARALLEL_2_SPLITS has split_2 or split_3', () => {
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
            severity: 'warning',
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

    it('should handle multiple validation errors', () => {
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
      expect(diagnostics).toHaveLength(2);
      // Should have errors for: shadow_mode, shadow_opacity; light_energy=0 is valid; splits ignored because mode defaults to ORTHOGONAL
      const hasModeError = diagnostics.some(d => d.message.includes('directional_shadow_mode'));
      const hasOpacityError = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasModeError && hasOpacityError).toBe(true);
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
            directional_shadow_split_1: 0.5,
            directional_shadow_split_2: 0.3,
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
