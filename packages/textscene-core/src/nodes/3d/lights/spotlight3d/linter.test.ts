/**
 * Tests for SpotLight3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('SpotLight3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid SpotLight3D properties', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 1.0
light_color = Color(1, 1, 1, 1)
spot_range = 10.0
spot_angle = 45.0
spot_attenuation = 1.0
spot_angle_attenuation = 1.0
shadow_enabled = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('light_energy validation', () => {
      it('should accept valid light_energy values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 2.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject negative light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = -1.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_energy');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject invalid light_energy format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = invalid
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_color = Color(0.95, 0.9, 0.85, 1)
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid Color format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_color = RGB(1, 1, 1)
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_color');
        expect(diagnostics[0].message).toContain('Color');
      });

      it('should reject Color with wrong number of components', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_color = Color(1, 1, 1)
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_color');
      });
    });

    describe('light_indirect_energy validation', () => {
      it('should accept valid light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_indirect_energy = 1.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_indirect_energy = 0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_indirect_energy = -0.5
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_volumetric_fog_energy = 2.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative light_volumetric_fog_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_volumetric_fog_energy = -1.0
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
shadow_enabled = ${value}
spot_range = 5.0
spot_angle = 45.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid shadow_enabled value', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_enabled = yes
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_enabled');
        expect(diagnostics[0].message).toContain('boolean');
      });

      it('should accept valid light_negative boolean', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_negative = true
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid shadow_reverse_cull_face boolean', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_reverse_cull_face = false
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('shadow bias properties validation', () => {
      it('should accept valid shadow_bias', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_bias = 0.1
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid shadow_normal_bias', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_normal_bias = 2.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid shadow_bias format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_bias = abc
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
shadow_blur = 5.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_blur = 0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_blur = -1.0
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
shadow_transmittance_bias = ${value}
spot_range = 5.0
spot_angle = 45.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject shadow_transmittance_bias below -10', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_transmittance_bias = -11
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_transmittance_bias');
        expect(diagnostics[0].message).toContain('between -10 and 10');
      });

      it('should reject shadow_transmittance_bias above 10', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_transmittance_bias = 11
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
shadow_opacity = ${value}
spot_range = 5.0
spot_angle = 45.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject shadow_opacity below 0', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_opacity = -0.1
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_opacity');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject shadow_opacity above 1', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
shadow_opacity = 1.5
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_specular = ${value}
spot_range = 5.0
spot_angle = 45.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject light_specular out of range', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_specular = 2.0
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_bake_mode = ${mode}
spot_range = 5.0
spot_angle = 45.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid bake mode', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_bake_mode = 5
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_cull_mask = ${value}
spot_range = 5.0
spot_angle = 45.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject cull_mask of 0', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_cull_mask = 0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });

      it('should reject cull_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_cull_mask = 2000000
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });
    });

    describe('spot_range validation', () => {
      it('should accept valid spot_range values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 10.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero spot_range', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_range');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative spot_range', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = -5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_range');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid spot_range format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = invalid
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_range');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('spot_attenuation validation', () => {
      it('should accept valid spot_attenuation values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = 1.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero spot_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = 0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject negative spot_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = -1.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_attenuation');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject invalid spot_attenuation format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = abc
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_attenuation');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('spot_angle validation', () => {
      it('should accept valid spot_angle values', () => {
        const validAngles = [0, 30, 45, 60, 90];
        for (const angle of validAngles) {
          const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = ${angle}
spot_range = 5.0
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject spot_angle above 90', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = 91
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_angle');
        expect(diagnostics[0].message).toContain('between 0 and 90');
      });

      it('should reject negative spot_angle', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = -5
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_angle');
        expect(diagnostics[0].message).toContain('between 0 and 90');
      });

      it('should reject invalid spot_angle format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = invalid
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_angle');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('spot_angle_attenuation validation', () => {
      it('should accept valid spot_angle_attenuation values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = 1.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero spot_angle_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = 0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject negative spot_angle_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = -1.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_angle_attenuation');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject invalid spot_angle_attenuation format', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = abc
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('spot_angle_attenuation');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('missing required properties errors', () => {
      it('should not error when spot_range is missing', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 1.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const rangeError = diagnostics.find(d => d.severity === 'error' && d.message.includes('spot_range'));
        expect(rangeError).toBeUndefined();
      });

      it('should not error when spot_angle is missing', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 1.0
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const angleError = diagnostics.find(d => d.severity === 'error' && d.message.includes('spot_angle'));
        expect(angleError).toBeUndefined();
      });

      it('should not error when both spot_range and spot_angle are missing', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 1.0
`;

        const diagnostics = linter.lint(content);
        const rangeError = diagnostics.find(d => d.severity === 'error' && d.message.includes('spot_range'));
        const angleError = diagnostics.find(d => d.severity === 'error' && d.message.includes('spot_angle'));
        expect(rangeError).toBeUndefined();
        expect(angleError).toBeUndefined();
      });

      it('should not error when both spot_range and spot_angle are present', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const requiredErrors = diagnostics.filter(d =>
          d.severity === 'error' &&
          (d.message.includes('spot_range') || d.message.includes('spot_angle'))
        );
        expect(requiredErrors).toHaveLength(0);
      });
    });

    describe('light energy warnings', () => {
      it('should warn on very low light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 0.005
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_energy = 150
spot_range = 5.0
spot_angle = 45.0
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

[node name="Spotlight" type="SpotLight3D"]
light_energy = 1.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const energyWarning = diagnostics.find(d => d.message.includes('Light energy'));
        expect(energyWarning).toBeUndefined();
      });
    });

    describe('spot_range warnings', () => {
      it('should warn on very large spot_range', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 1500
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Light range'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very large');
        expect(warning?.message).toContain('1500');
        expect(warning?.message).toContain('performance');
      });

      it('should warn on very small spot_range', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 0.05
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Light range'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very small');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('might not be visible');
      });

      it('should not warn on normal spot_range values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 10.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const rangeWarning = diagnostics.find(d => d.message.includes('Light range'));
        expect(rangeWarning).toBeUndefined();
      });
    });

    describe('spot_attenuation warnings', () => {
      it('should warn on very low spot_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = 0.05
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('slow falloff');
      });

      it('should warn on very high spot_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = 7.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('7');
        expect(warning?.message).toContain('fast falloff');
      });

      it('should not warn on normal spot_attenuation values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = 1.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation'));
        expect(attenuationWarning).toBeUndefined();
      });
    });

    describe('spot_angle_attenuation warnings', () => {
      it('should warn on very low spot_angle_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = 0.05
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Angular attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.05');
        expect(warning?.message).toContain('soft edges');
      });

      it('should warn on very high spot_angle_attenuation', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = 7.0
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Angular attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('7');
        expect(warning?.message).toContain('sharp edges');
      });

      it('should not warn on normal spot_angle_attenuation values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle_attenuation = 1.5
spot_range = 5.0
spot_angle = 45.0
`;

        const diagnostics = linter.lint(content);
        const attenuationWarning = diagnostics.find(d => d.message.includes('Angular attenuation'));
        expect(attenuationWarning).toBeUndefined();
      });
    });

    describe('spot_angle warnings', () => {
      it('should warn on very small spot_angle', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = 0.5
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Spot angle'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very small');
        expect(warning?.message).toContain('0.5');
        expect(warning?.message).toContain('might not be visible');
      });

      it('should not warn on normal spot_angle values', () => {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = 45.0
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const angleWarning = diagnostics.find(d => d.message.includes('Spot angle'));
        expect(angleWarning).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
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
spot_range = 10.0
spot_attenuation = 1.0
spot_angle = 45.0
spot_angle_attenuation = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 0
spot_angle = 100
shadow_opacity = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(2);
      // light_energy=0 is valid; spot_angle=100 and shadow_opacity=2.0 are errors
      const hasAngleError = diagnostics.some(d => d.message.includes('spot_angle'));
      const hasOpacityError = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasAngleError && hasOpacityError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 1.5e0
shadow_bias = 1e-1
spot_range = 5e0
spot_attenuation = 1.2e0
spot_angle = 4.5e1
spot_angle_attenuation = 1.0e0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate mixed warnings and errors', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 150
spot_range = 1500
spot_angle = 0.5
spot_attenuation = 0.05
shadow_opacity = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme values and errors for invalid shadow_opacity
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasErrors).toBe(true);
    });

    it('should handle only spot-specific properties', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_range = 10.0
spot_angle = 45.0
spot_attenuation = 1.0
spot_angle_attenuation = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boundary values for spot_angle', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = 0.9
spot_range = 5.0
`;

      const diagnostics = linter.lint(content);
      // Should have a warning for very small angle (below 1 degree)
      const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('very small'));
      expect(warning).toBeDefined();
    });

    it('should handle extreme combinations', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
light_energy = 0.005
spot_range = 1500
spot_angle = 0.5
spot_attenuation = 7.0
spot_angle_attenuation = 7.0
`;

      const diagnostics = linter.lint(content);
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
      const validBoundaries = [0, 90];
      for (const angle of validBoundaries) {
        const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_angle = ${angle}
spot_range = 5.0
`;

        const diagnostics = linter.lint(content);
        const angleError = diagnostics.find(d => d.severity === 'error' && d.message.includes('spot_angle'));
        expect(angleError).toBeUndefined();
      }
    });

    it('should handle zero attenuation values (edge case)', () => {
      const content = `[gd_scene format=3]

[node name="Spotlight" type="SpotLight3D"]
spot_attenuation = 0
spot_angle_attenuation = 0
spot_range = 5.0
spot_angle = 45.0
`;

      const diagnostics = linter.lint(content);
      // Zero attenuation is valid but should trigger warnings
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });
});
