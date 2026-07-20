/**
 * Tests for SpotLight3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('SpotLight3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid SpotLight3D properties', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            light_energy: 1.0,
            light_color: 'Color(1, 1, 1, 1)',
            spot_range: 10.0,
            spot_angle: 45.0,
            spot_attenuation: 1.0,
            spot_angle_attenuation: 1.0,
            shadow_enabled: true,
          })
        )
      );
    });

    // Zero-energy/attenuation accept cases trigger a "very low" warning, so only
    // the absence of *errors* is asserted (cannot use expectClean).
    it('should accept zero light_energy', () => {
      expectNoErrors(scene(node('SpotLight3D', { light_energy: 0 })));
    });

    it('should accept zero spot_attenuation', () => {
      expectNoErrors(scene(node('SpotLight3D', { spot_attenuation: 0 })));
    });

    it('should accept zero spot_angle_attenuation', () => {
      expectNoErrors(scene(node('SpotLight3D', { spot_angle_attenuation: 0 })));
    });

    runPropertyValidation({ nodeType: 'SpotLight3D' }, [
      {
        prop: 'light_energy',
        valid: [2.5],
        invalid: [
          { value: -1.0, contains: ['non-negative'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'spot_attenuation',
        valid: [1.5],
        invalid: [
          { value: -1.0, contains: ['non-negative'] },
          { value: 'abc', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'spot_angle_attenuation',
        valid: [1.5],
        invalid: [
          { value: -1.0, contains: ['non-negative'] },
          { value: 'abc', contains: ['must be a number'] },
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
        invalid: [{ value: -0.5, contains: ['non-negative'] }],
      },
      {
        prop: 'light_volumetric_fog_energy',
        valid: [2.0],
        invalid: [{ value: -1.0, contains: ['non-negative'] }],
      },
      {
        prop: 'shadow_enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
      { prop: 'light_negative', valid: [true] },
      { prop: 'shadow_reverse_cull_face', valid: [false] },
      {
        prop: 'shadow_bias',
        valid: [0.1],
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      { prop: 'shadow_normal_bias', valid: [2.0] },
      {
        prop: 'shadow_blur',
        valid: [5.0, 0],
        invalid: [{ value: -1.0, contains: ['non-negative'] }],
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
        prop: 'light_specular',
        valid: [0, 0.5, 1],
        invalid: [{ value: 2.0, contains: ['between 0 and 1'] }],
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
        prop: 'spot_range',
        valid: [10.0],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -5.0, contains: ['greater than 0'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'spot_angle',
        valid: [0, 30, 45, 60, 90],
        invalid: [
          { value: 91, contains: ['between 0 and 90'] },
          { value: -5, contains: ['between 0 and 90'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
    ]);
  });

  describe('Semantic Validation', () => {
    describe('missing required properties errors', () => {
      it('should not error when spot_range is missing', () => {
        expectNoErrors(scene(node('SpotLight3D', { light_energy: 1.0, spot_angle: 45.0 })), {
          prop: 'spot_range',
        });
      });

      it('should not error when spot_angle is missing', () => {
        expectNoErrors(scene(node('SpotLight3D', { light_energy: 1.0, spot_range: 5.0 })), {
          prop: 'spot_angle',
        });
      });

      it('should not error when both spot_range and spot_angle are missing', () => {
        const content = scene(node('SpotLight3D', { light_energy: 1.0 }));
        expectNoErrors(content, { prop: 'spot_range' });
        expectNoErrors(content, { prop: 'spot_angle' });
      });

      it('should not error when both spot_range and spot_angle are present', () => {
        const content = scene(node('SpotLight3D', { spot_range: 5.0, spot_angle: 45.0 }));
        expectNoErrors(content, { prop: 'spot_range' });
        expectNoErrors(content, { prop: 'spot_angle' });
      });
    });

    describe('light energy warnings', () => {
      it('should warn on very low light_energy', () => {
        expectDiagnostic(scene(node('SpotLight3D', { light_energy: 0.005 })), {
          ruleName: 'spotlight3d-extreme-energy',
          severity: 'warning',
          contains: ['Light energy', 'very low', '0.005'],
        });
      });

      it('should warn on very high light_energy', () => {
        expectDiagnostic(scene(node('SpotLight3D', { light_energy: 150 })), {
          ruleName: 'spotlight3d-extreme-energy',
          severity: 'warning',
          contains: ['Light energy', 'very high', '150'],
        });
      });

      it('should not warn on normal light_energy values', () => {
        expectNoDiagnostic(scene(node('SpotLight3D', { light_energy: 1.5 })), { prop: 'Light energy' });
      });
    });

    describe('spot_range warnings', () => {
      it('should warn on very large spot_range', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_range: 1500 })), {
          ruleName: 'spotlight3d-large-range',
          severity: 'warning',
          contains: ['Light range', 'very large', '1500', 'performance'],
        });
      });

      it('should warn on very small spot_range', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_range: 0.05 })), {
          ruleName: 'spotlight3d-small-range',
          severity: 'warning',
          contains: ['Light range', 'very small', '0.05', 'might not be visible'],
        });
      });

      it('should not warn on normal spot_range values', () => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_range: 10.0 })), { prop: 'Light range' });
      });
    });

    describe('spot_attenuation warnings', () => {
      it('should warn on very low spot_attenuation', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_attenuation: 0.05 })), {
          ruleName: 'spotlight3d-extreme-attenuation',
          severity: 'warning',
          contains: ['attenuation', 'very low', '0.05', 'slow falloff'],
        });
      });

      it('should warn on very high spot_attenuation', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_attenuation: 7.0 })), {
          ruleName: 'spotlight3d-extreme-attenuation',
          severity: 'warning',
          contains: ['attenuation', 'very high', '7', 'fast falloff'],
        });
      });

      it('should not warn on normal spot_attenuation values', () => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_attenuation: 1.5 })), { prop: 'attenuation' });
      });
    });

    describe('spot_angle_attenuation warnings', () => {
      it('should warn on very low spot_angle_attenuation', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_angle_attenuation: 0.05 })), {
          ruleName: 'spotlight3d-extreme-angle-attenuation',
          severity: 'warning',
          contains: ['Angular attenuation', 'very low', '0.05', 'soft edges'],
        });
      });

      it('should warn on very high spot_angle_attenuation', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_angle_attenuation: 7.0 })), {
          ruleName: 'spotlight3d-extreme-angle-attenuation',
          severity: 'warning',
          contains: ['Angular attenuation', 'very high', '7', 'sharp edges'],
        });
      });

      it('should not warn on normal spot_angle_attenuation values', () => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_angle_attenuation: 1.5 })), {
          prop: 'Angular attenuation',
        });
      });
    });

    describe('spot_angle warnings', () => {
      it('should warn on very small spot_angle', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_angle: 0.5 })), {
          ruleName: 'spotlight3d-small-angle',
          severity: 'warning',
          contains: ['Spot angle', 'very small', '0.5', 'might not be visible'],
        });
      });

      it('should not warn on normal spot_angle values', () => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_angle: 45.0 })), { prop: 'Spot angle' });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('SpotLight3D')));
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            light_energy: '1.0',
            light_color: 'Color(1, 0.95, 0.9, 1)',
            light_indirect_energy: '1.0',
            light_volumetric_fog_energy: '1.0',
            light_negative: false,
            light_specular: '0.5',
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            shadow_enabled: true,
            shadow_bias: '0.1',
            shadow_normal_bias: '2.0',
            shadow_blur: '1.0',
            shadow_transmittance_bias: '0.5',
            shadow_opacity: '1.0',
            shadow_reverse_cull_face: false,
            spot_range: '10.0',
            spot_attenuation: '1.0',
            spot_angle: '45.0',
            spot_angle_attenuation: '1.0',
          })
        )
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(node('SpotLight3D', { light_energy: 0, spot_angle: 100, shadow_opacity: '2.0' }))
      );
      expect(diagnostics).toHaveLength(2);
      // light_energy=0 is valid; spot_angle=100 and shadow_opacity=2.0 are errors
      const hasAngleError = diagnostics.some(d => d.message.includes('spot_angle'));
      const hasOpacityError = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasAngleError && hasOpacityError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            light_energy: '1.5e0',
            shadow_bias: '1e-1',
            spot_range: '5e0',
            spot_attenuation: '1.2e0',
            spot_angle: '4.5e1',
            spot_angle_attenuation: '1.0e0',
          })
        )
      );
    });

    it('should validate mixed warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('SpotLight3D', {
            light_energy: 150,
            spot_range: 1500,
            spot_angle: '0.5',
            spot_attenuation: '0.05',
            shadow_opacity: '2.0',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme values and errors for invalid shadow_opacity
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasErrors).toBe(true);
    });

    it('should handle only spot-specific properties', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            spot_range: 10.0,
            spot_angle: 45.0,
            spot_attenuation: 1.0,
            spot_angle_attenuation: 1.0,
          })
        )
      );
    });

    it('should handle boundary values for spot_angle', () => {
      // Should have a warning for very small angle (below 1 degree)
      expectDiagnostic(scene(node('SpotLight3D', { spot_angle: 0.9 })), {
        ruleName: 'spotlight3d-small-angle',
        severity: 'warning',
        contains: ['very small'],
      });
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        scene(
          node('SpotLight3D', {
            light_energy: '0.005',
            spot_range: 1500,
            spot_angle: '0.5',
            spot_attenuation: '7.0',
            spot_angle_attenuation: '7.0',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(4);
      // Should have warnings for all extreme values
      const energyWarning = diagnostics.find(d => d.message.includes('Light energy') && d.message.includes('very low'));
      const rangeWarning = diagnostics.find(d => d.message.includes('Light range') && d.message.includes('very large'));
      const angleWarning = diagnostics.find(d => d.message.includes('Spot angle') && d.message.includes('very small'));
      const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation') && d.message.includes('very high'));
      expect(energyWarning).toBeDefined();
      expect(rangeWarning).toBeDefined();
      expect(angleWarning).toBeDefined();
      expect(attenuationWarning).toBeDefined();
    });

    it('should handle spot_angle at exact boundaries', () => {
      for (const angle of [0, 90]) {
        expectNoErrors(scene(node('SpotLight3D', { spot_angle: angle, spot_range: 5.0 })), {
          prop: 'spot_angle',
        });
      }
    });

    it('should handle zero attenuation values (edge case)', () => {
      // Zero attenuation is valid but should trigger warnings
      expectNoErrors(
        scene(
          node('SpotLight3D', {
            spot_attenuation: 0,
            spot_angle_attenuation: 0,
            spot_range: 5.0,
            spot_angle: 45.0,
          })
        )
      );
    });
  });
});
