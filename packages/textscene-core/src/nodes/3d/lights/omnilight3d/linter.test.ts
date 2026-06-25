/**
 * Tests for OmniLight3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('OmniLight3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid OmniLight3D properties', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 1.0
light_color = Color(1, 1, 1, 1)
omni_range = 5.0
omni_attenuation = 1.0
shadow_enabled = true
omni_shadow_mode = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('light_energy validation', () => {
      it('should accept valid light_energy values', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 2.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero light_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject negative light_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = -1.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_energy');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject invalid light_energy format', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = invalid
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_energy');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('light_color validation', () => {
      it('should accept valid Color format', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_color = Color(0.95, 0.9, 0.85, 1)
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid Color format', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_color = RGB(1, 1, 1)
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_color');
        expect(diagnostics[0].message).toContain('Color');
      });

      it('should reject Color with wrong number of components', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_color = Color(1, 1, 1)
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_color');
      });
    });

    describe('light_indirect_energy validation', () => {
      it('should accept valid light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_indirect_energy = 1.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_indirect_energy = 0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_indirect_energy = -0.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_indirect_energy');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('light_volumetric_fog_energy validation', () => {
      it('should accept valid light_volumetric_fog_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_volumetric_fog_energy = 2.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative light_volumetric_fog_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_volumetric_fog_energy = -1.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_volumetric_fog_energy');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('boolean property validation', () => {
      it('should accept valid shadow_enabled boolean', () => {
        const validValues = ['true', 'false'];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_enabled = ${value}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid shadow_enabled value', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_enabled = yes
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_enabled');
        expect(diagnostics[0].message).toContain('boolean');
      });

      it('should accept valid light_negative boolean', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_negative = true
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid shadow_reverse_cull_face boolean', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_reverse_cull_face = false
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('shadow bias properties validation', () => {
      it('should accept valid shadow_bias', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_bias = 0.1
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid shadow_normal_bias', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_normal_bias = 2.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid shadow_bias format', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_bias = abc
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_bias');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('shadow_blur validation', () => {
      it('should accept valid shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_blur = 5.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_blur = 0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_blur = -1.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_blur');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('shadow_transmittance_bias validation', () => {
      it('should accept valid shadow_transmittance_bias within range', () => {
        const validValues = [-10, -5, 0, 5, 10];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_transmittance_bias = ${value}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject shadow_transmittance_bias below -10', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_transmittance_bias = -11
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_transmittance_bias');
        expect(diagnostics[0].message).toContain('between -10 and 10');
      });

      it('should reject shadow_transmittance_bias above 10', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_transmittance_bias = 11
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_transmittance_bias');
        expect(diagnostics[0].message).toContain('between -10 and 10');
      });
    });

    describe('shadow_opacity validation', () => {
      it('should accept valid shadow_opacity values', () => {
        const validValues = [0, 0.5, 1];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_opacity = ${value}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject shadow_opacity below 0', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_opacity = -0.1
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_opacity');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject shadow_opacity above 1', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
shadow_opacity = 1.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_opacity');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('light_specular validation', () => {
      it('should accept valid light_specular values', () => {
        const validValues = [0, 0.5, 1];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_specular = ${value}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject light_specular out of range', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_specular = 2.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_specular');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('light_bake_mode validation', () => {
      it('should accept all valid bake modes', () => {
        const validModes = [0, 1, 2]; // DISABLED, STATIC, DYNAMIC
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_bake_mode = ${mode}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid bake mode', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_bake_mode = 5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_bake_mode');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('light_cull_mask validation', () => {
      it('should accept valid cull_mask values', () => {
        const validValues = [1, 100, 1048575];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_cull_mask = ${value}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject cull_mask of 0', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_cull_mask = 0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });

      it('should reject cull_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_cull_mask = 2000000
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });
    });

    describe('omni_range validation', () => {
      it('should accept valid omni_range values', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 10.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero omni_range', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_range');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative omni_range', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = -5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_range');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid omni_range format', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_range');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('omni_attenuation validation', () => {
      it('should accept valid omni_attenuation values', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = 1.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero omni_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = 0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        // Zero attenuation triggers a warning (very low)
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject negative omni_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = -1.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_attenuation');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject invalid omni_attenuation format', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = abc
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_attenuation');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('omni_shadow_mode validation', () => {
      it('should accept all valid shadow modes', () => {
        const validModes = [0, 1]; // DUAL_PARABOLOID, CUBE
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_shadow_mode = ${mode}
omni_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid shadow mode value', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_shadow_mode = 5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_shadow_mode');
        expect(diagnostics[0].message).toContain('0-1');
      });

      it('should reject negative shadow mode', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_shadow_mode = -1
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('omni_shadow_mode');
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('missing omni_range error', () => {
      it('should not error when omni_range is missing', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 1.0
light_color = Color(1, 1, 1, 1)
`;

        const diagnostics = linter.lint(content);
        const rangeError = diagnostics.find(d => d.severity === 'error' && d.message.includes('omni_range'));
        expect(rangeError).toBeUndefined();
      });

      it('should not error when omni_range is present', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const rangeError = diagnostics.find(d => d.severity === 'error' && d.message.includes('omni_range'));
        expect(rangeError).toBeUndefined();
      });
    });

    describe('light energy warnings', () => {
      it('should warn on very low light_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 0.005
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Light energy'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.005');
      });

      it('should warn on very high light_energy', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 150
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Light energy'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('150');
      });

      it('should not warn on normal light_energy values', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 1.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const energyWarning = diagnostics.find(d => d.message.includes('Light energy'));
        expect(energyWarning).toBeUndefined();
      });
    });

    describe('omni_range warnings', () => {
      it('should warn on very large omni_range', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 1500
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Light range'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very large');
        expect(warning?.message).toContain('1500');
        expect(warning?.message).toContain('performance');
      });

      it('should warn on very small omni_range', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 0.05
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Light range'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very small');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('might not be visible');
      });

      it('should not warn on normal omni_range values', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 10.0
`;

        const diagnostics = linter.lint(content);
        const rangeWarning = diagnostics.find(d => d.message.includes('Light range'));
        expect(rangeWarning).toBeUndefined();
      });
    });

    describe('omni_attenuation warnings', () => {
      it('should warn on very low omni_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = 0.05
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('slow falloff');
      });

      it('should warn on very high omni_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = 7.0
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('7');
        expect(warning?.message).toContain('performance');
      });

      it('should not warn on normal omni_attenuation values', () => {
        const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_attenuation = 1.5
omni_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation'));
        expect(attenuationWarning).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 1.0
light_color = Color(1, 0.95, 0.9, 1)
light_indirect_energy = 1.0
light_volumetric_fog_energy = 1.0
light_negative = false
light_specular = 0.5
light_bake_mode = 1
light_cull_mask = 1048575
shadow_enabled = true
shadow_bias = 0.1
shadow_normal_bias = 2.0
shadow_blur = 1.0
shadow_transmittance_bias = 0.5
shadow_opacity = 1.0
shadow_reverse_cull_face = false
omni_range = 10.0
omni_attenuation = 1.0
omni_shadow_mode = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 0
omni_shadow_mode = 10
shadow_opacity = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(2);
      // Should have errors for: omni_shadow_mode, shadow_opacity; light_energy=0 is now valid
      const hasModeError = diagnostics.some(d => d.message.includes('omni_shadow_mode'));
      const hasOpacityError = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasModeError && hasOpacityError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 1.5e0
shadow_bias = 1e-1
omni_range = 5e0
omni_attenuation = 1.2e0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate mixed warnings and errors', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 150
omni_range = 1500
omni_attenuation = 0.05
shadow_opacity = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme values and errors for invalid shadow_opacity
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasErrors).toBe(true);
    });

    it('should handle only omni-specific properties', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 5.0
omni_attenuation = 1.0
omni_shadow_mode = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boundary values for omni_range', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
omni_range = 0.09
`;

      const diagnostics = linter.lint(content);
      // Should have a warning for very small range (below 0.1)
      const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('very small'));
      expect(warning).toBeDefined();
    });

    it('should handle extreme combinations', () => {
      const content = `[gd_scene format=3]

[node name="PointLight" type="OmniLight3D"]
light_energy = 0.005
omni_range = 1500
omni_attenuation = 7.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have warnings for all three extreme values
      const energyWarning = diagnostics.find(d => d.message.includes('Light energy') && d.message.includes('very low'));
      const rangeWarning = diagnostics.find(d => d.message.includes('Light range') && d.message.includes('very large'));
      const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation') && d.message.includes('very high'));
      expect(energyWarning).toBeDefined();
      expect(rangeWarning).toBeDefined();
      expect(attenuationWarning).toBeDefined();
    });
  });
});
