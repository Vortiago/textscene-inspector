/**
 * Tests for OmniLight3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('OmniLight3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid OmniLight3D properties', () => {
      expectClean(
        scene(
          node('OmniLight3D', {
            light_energy: 1.0,
            light_color: 'Color(1, 1, 1, 1)',
            omni_range: 5.0,
            omni_attenuation: 1.0,
            shadow_enabled: true,
            omni_shadow_mode: 1,
          })
        )
      );
    });

    runPropertyValidation({ nodeType: 'OmniLight3D' }, [
      {
        prop: 'light_energy',
        valid: [2.5],
        invalid: [
          { value: -1.0, contains: ['non-negative'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'light_color',
        valid: ['Color(0.95, 0.9, 0.85, 1)'],
        invalid: [{ value: 'RGB(1, 1, 1)', contains: ['Color'] }, { value: 'Color(1, 1, 1)' }],
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
        valid: [1, 100, 1048575],
        invalid: [
          { value: 0, contains: ['between 1 and 1048575'] },
          { value: 2000000, contains: ['between 1 and 1048575'] },
        ],
      },
      {
        prop: 'omni_range',
        valid: [10.0],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -5.0, contains: ['greater than 0'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'omni_attenuation',
        valid: [1.5],
        invalid: [
          { value: -1.0, contains: ['non-negative'] },
          { value: 'abc', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'omni_shadow_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }, { value: -1 }],
      },
    ]);

    // Zero-energy accept cases trigger a "very low" warning, so only the
    // absence of *errors* is asserted (cannot use expectClean).
    it('should accept zero light_energy', () => {
      expectNoErrors(scene(node('OmniLight3D', { light_energy: 0, omni_range: 5.0 })));
    });

    it('should accept zero omni_attenuation', () => {
      expectNoErrors(scene(node('OmniLight3D', { omni_attenuation: 0, omni_range: 5.0 })));
    });
  });

  describe('Semantic Validation', () => {
    describe('missing omni_range error', () => {
      it('should not error when omni_range is missing', () => {
        expectNoErrors(
          scene(node('OmniLight3D', { light_energy: 1.0, light_color: 'Color(1, 1, 1, 1)' })),
          { prop: 'omni_range' }
        );
      });

      it('should not error when omni_range is present', () => {
        expectNoErrors(scene(node('OmniLight3D', { omni_range: 5.0 })), { prop: 'omni_range' });
      });
    });

    describe('light energy warnings', () => {
      it('should warn on very low light_energy', () => {
        const diagnostics = lint(scene(node('OmniLight3D', { light_energy: 0.005, omni_range: 5.0 })));
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(
          d => d.severity === 'warning' && d.message.includes('Light energy')
        );
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.005');
      });

      it('should warn on very high light_energy', () => {
        const diagnostics = lint(scene(node('OmniLight3D', { light_energy: 150, omni_range: 5.0 })));
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(
          d => d.severity === 'warning' && d.message.includes('Light energy')
        );
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('150');
      });

      it('should not warn on normal light_energy values', () => {
        const diagnostics = lint(scene(node('OmniLight3D', { light_energy: 1.5, omni_range: 5.0 })));
        const energyWarning = diagnostics.find(d => d.message.includes('Light energy'));
        expect(energyWarning).toBeUndefined();
      });
    });

    describe('omni_range warnings', () => {
      it('should warn on very large omni_range', () => {
        const diagnostics = lint(scene(node('OmniLight3D', { omni_range: 1500 })));
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(
          d => d.severity === 'warning' && d.message.includes('Light range')
        );
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very large');
        expect(warning?.message).toContain('1500');
        expect(warning?.message).toContain('performance');
      });

      it('should warn on very small omni_range', () => {
        const diagnostics = lint(scene(node('OmniLight3D', { omni_range: 0.05 })));
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(
          d => d.severity === 'warning' && d.message.includes('Light range')
        );
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very small');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('might not be visible');
      });

      it('should not warn on normal omni_range values', () => {
        const diagnostics = lint(scene(node('OmniLight3D', { omni_range: 10.0 })));
        const rangeWarning = diagnostics.find(d => d.message.includes('Light range'));
        expect(rangeWarning).toBeUndefined();
      });
    });

    describe('omni_attenuation warnings', () => {
      it('should warn on very low omni_attenuation', () => {
        const diagnostics = lint(
          scene(node('OmniLight3D', { omni_attenuation: 0.05, omni_range: 5.0 }))
        );
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(
          d => d.severity === 'warning' && d.message.includes('attenuation')
        );
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('slow falloff');
      });

      it('should warn on very high omni_attenuation', () => {
        const diagnostics = lint(
          scene(node('OmniLight3D', { omni_attenuation: 7.0, omni_range: 5.0 }))
        );
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(
          d => d.severity === 'warning' && d.message.includes('attenuation')
        );
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('7');
        expect(warning?.message).toContain('performance');
      });

      it('should not warn on normal omni_attenuation values', () => {
        const diagnostics = lint(
          scene(node('OmniLight3D', { omni_attenuation: 1.5, omni_range: 5.0 }))
        );
        const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation'));
        expect(attenuationWarning).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('OmniLight3D')));
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('OmniLight3D', {
            light_energy: 1.0,
            light_color: 'Color(1, 0.95, 0.9, 1)',
            light_indirect_energy: 1.0,
            light_volumetric_fog_energy: 1.0,
            light_negative: false,
            light_specular: 0.5,
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            shadow_enabled: true,
            shadow_bias: 0.1,
            shadow_normal_bias: 2.0,
            shadow_blur: 1.0,
            shadow_transmittance_bias: 0.5,
            shadow_opacity: 1.0,
            shadow_reverse_cull_face: false,
            omni_range: 10.0,
            omni_attenuation: 1.0,
            omni_shadow_mode: 1,
          })
        )
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(node('OmniLight3D', { light_energy: 0, omni_shadow_mode: 10, shadow_opacity: 2.0 }))
      );
      expect(diagnostics).toHaveLength(2);
      // Should have errors for: omni_shadow_mode, shadow_opacity; light_energy=0 is now valid
      const hasModeError = diagnostics.some(d => d.message.includes('omni_shadow_mode'));
      const hasOpacityError = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasModeError && hasOpacityError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('OmniLight3D', {
            light_energy: '1.5e0',
            shadow_bias: '1e-1',
            omni_range: '5e0',
            omni_attenuation: '1.2e0',
          })
        )
      );
    });

    it('should validate mixed warnings and errors', () => {
      const diagnostics = lint(
        scene(
          node('OmniLight3D', {
            light_energy: 150,
            omni_range: 1500,
            omni_attenuation: 0.05,
            shadow_opacity: 2.0,
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme values and errors for invalid shadow_opacity
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasErrors).toBe(true);
    });

    it('should handle only omni-specific properties', () => {
      expectClean(
        scene(node('OmniLight3D', { omni_range: 5.0, omni_attenuation: 1.0, omni_shadow_mode: 0 }))
      );
    });

    it('should handle boundary values for omni_range', () => {
      const diagnostics = lint(scene(node('OmniLight3D', { omni_range: 0.09 })));
      // Should have a warning for very small range (below 0.1)
      const warning = diagnostics.find(
        d => d.severity === 'warning' && d.message.includes('very small')
      );
      expect(warning).toBeDefined();
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        scene(node('OmniLight3D', { light_energy: 0.005, omni_range: 1500, omni_attenuation: 7.0 }))
      );
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have warnings for all three extreme values
      const energyWarning = diagnostics.find(
        d => d.message.includes('Light energy') && d.message.includes('very low')
      );
      const rangeWarning = diagnostics.find(
        d => d.message.includes('Light range') && d.message.includes('very large')
      );
      const attenuationWarning = diagnostics.find(
        d => d.message.includes('attenuation') && d.message.includes('very high')
      );
      expect(energyWarning).toBeDefined();
      expect(rangeWarning).toBeDefined();
      expect(attenuationWarning).toBeDefined();
    });
  });
});
