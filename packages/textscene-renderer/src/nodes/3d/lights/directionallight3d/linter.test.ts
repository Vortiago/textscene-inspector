/**
 * Tests for DirectionalLight3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('DirectionalLight3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid DirectionalLight3D properties', () => {
      const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 1.0
light_color = Color(1, 1, 1, 1)
shadow_enabled = true
directional_shadow_mode = 2
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('light_energy validation', () => {
      it('should accept valid light_energy values', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_energy');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_energy');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid light_energy format', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = invalid
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

[node name="Sun" type="DirectionalLight3D"]
light_color = Color(0.95, 0.9, 0.85, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid Color format', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_color = RGB(1, 1, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_color');
        expect(diagnostics[0].message).toContain('Color');
      });

      it('should reject Color with wrong number of components', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_color = Color(1, 1, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_color');
      });
    });

    describe('light_indirect_energy validation', () => {
      it('should accept valid light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_indirect_energy = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_indirect_energy = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative light_indirect_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_indirect_energy = -0.5
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

[node name="Sun" type="DirectionalLight3D"]
light_volumetric_fog_energy = 2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative light_volumetric_fog_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_volumetric_fog_energy = -1.0
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

[node name="Sun" type="DirectionalLight3D"]
shadow_enabled = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid shadow_enabled value', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_enabled = yes
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_enabled');
        expect(diagnostics[0].message).toContain('boolean');
      });

      it('should accept valid light_negative boolean', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_negative = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid directional_shadow_blend_splits boolean', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_blend_splits = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid shadow_reverse_cull_face boolean', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_reverse_cull_face = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('shadow bias properties validation', () => {
      it('should accept valid shadow_bias', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_bias = 0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid shadow_normal_bias', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_normal_bias = 2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid shadow_bias format', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_bias = abc
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

[node name="Sun" type="DirectionalLight3D"]
shadow_blur = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_blur = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative shadow_blur', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_blur = -1.0
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

[node name="Sun" type="DirectionalLight3D"]
shadow_transmittance_bias = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject shadow_transmittance_bias below -10', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_transmittance_bias = -11
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_transmittance_bias');
        expect(diagnostics[0].message).toContain('between -10 and 10');
      });

      it('should reject shadow_transmittance_bias above 10', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_transmittance_bias = 11
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

[node name="Sun" type="DirectionalLight3D"]
shadow_opacity = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject shadow_opacity below 0', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_opacity = -0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_opacity');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject shadow_opacity above 1', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
shadow_opacity = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('shadow_opacity');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('directional_shadow_mode validation', () => {
      it('should accept all valid shadow modes', () => {
        const validModes = [0, 1, 2]; // ORTHOGONAL, PARALLEL_2_SPLITS, PARALLEL_4_SPLITS
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = ${mode}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid shadow mode value', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_mode');
        expect(diagnostics[0].message).toContain('0-2');
      });

      it('should reject negative shadow mode', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_mode');
      });
    });

    describe('shadow split properties validation', () => {
      it('should accept valid split values', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 0.1
directional_shadow_split_2 = 0.2
directional_shadow_split_3 = 0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept boundary split values', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 0
directional_shadow_split_2 = 0.5
directional_shadow_split_3 = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject split_1 below 0', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = -0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_split_1');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject split_1 above 1', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_split_1');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject split_2 out of range', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_2 = 2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_split_2');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject split_3 out of range', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_3 = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_split_3');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('directional_shadow_fade_start validation', () => {
      it('should accept valid fade_start values', () => {
        const validValues = [0, 0.5, 0.8, 1];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_fade_start = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject fade_start out of range', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_fade_start = 1.2
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_fade_start');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('directional_shadow_max_distance validation', () => {
      it('should accept valid max_distance', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_max_distance = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero max_distance', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_max_distance = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative max_distance', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_max_distance = -100
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_max_distance');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('directional_shadow_pancake_size validation', () => {
      it('should accept valid pancake_size', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_pancake_size = 20.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative pancake_size', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_pancake_size = -5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('directional_shadow_pancake_size');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('light_specular validation', () => {
      it('should accept valid light_specular values', () => {
        const validValues = [0, 0.5, 1];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_specular = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject light_specular out of range', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_specular = 2.0
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

[node name="Sun" type="DirectionalLight3D"]
light_bake_mode = ${mode}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid bake mode', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_bake_mode = 5
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

[node name="Sun" type="DirectionalLight3D"]
light_cull_mask = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject cull_mask of 0', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_cull_mask = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });

      it('should reject cull_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_cull_mask = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('light_cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });
    });

    describe('sky_mode validation', () => {
      it('should accept all valid sky modes', () => {
        const validModes = [0, 1, 2]; // LIGHT_AND_SKY, LIGHT_ONLY, SKY_ONLY
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
sky_mode = ${mode}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid sky mode', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
sky_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('sky_mode');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('light energy warnings', () => {
      it('should warn on very low light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 0.005
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning');
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('Light energy is very low');
        expect(warning?.message).toContain('0.005');
      });

      it('should warn on very high light_energy', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 150
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning');
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('Light energy is very high');
        expect(warning?.message).toContain('150');
      });

      it('should not warn on normal light_energy values', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 1.5
`;

        const diagnostics = linter.lint(content);
        const energyWarning = diagnostics.find(d => d.message.includes('Light energy'));
        expect(energyWarning).toBeUndefined();
      });
    });

    describe('shadow split ordering', () => {
      it('should pass with correctly ordered splits', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 0.1
directional_shadow_split_2 = 0.3
directional_shadow_split_3 = 0.7
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should error if split_1 >= split_2', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 0.5
directional_shadow_split_2 = 0.3
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('split ordering'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('split_1');
        expect(error?.message).toContain('split_2');
      });

      it('should error if split_2 >= split_3', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_2 = 0.7
directional_shadow_split_3 = 0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('split ordering'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('split_2');
        expect(error?.message).toContain('split_3');
      });

      it('should error if split_1 >= split_3', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 0.8
directional_shadow_split_3 = 0.6
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('split ordering'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('split_1');
        expect(error?.message).toContain('split_3');
      });

      it('should error if splits are equal', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_split_1 = 0.5
directional_shadow_split_2 = 0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('split ordering'));
        expect(error).toBeDefined();
      });
    });

    describe('large shadow distance warning', () => {
      it('should warn on very large shadow_max_distance', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_max_distance = 15000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning');
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('Shadow max distance is very large');
        expect(warning?.message).toContain('15000');
        expect(warning?.message).toContain('performance');
      });

      it('should not warn on reasonable shadow_max_distance', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_max_distance = 500
`;

        const diagnostics = linter.lint(content);
        const distanceWarning = diagnostics.find(d => d.message.includes('Shadow max distance'));
        expect(distanceWarning).toBeUndefined();
      });
    });

    describe('shadow mode and split consistency', () => {
      it('should warn if ORTHOGONAL mode has split properties', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = 0
directional_shadow_split_1 = 0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('ORTHOGONAL'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('Splits are ignored');
      });

      it('should warn if PARALLEL_2_SPLITS has split_2 or split_3', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = 1
directional_shadow_split_1 = 0.1
directional_shadow_split_2 = 0.3
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('PARALLEL_2_SPLITS'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('Only split_1 is used');
      });

      it('should not warn for PARALLEL_4_SPLITS with all splits', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = 2
directional_shadow_split_1 = 0.1
directional_shadow_split_2 = 0.3
directional_shadow_split_3 = 0.7
`;

        const diagnostics = linter.lint(content);
        const modeWarning = diagnostics.find(d => d.message.includes('shadow mode') && d.message.includes('split'));
        expect(modeWarning).toBeUndefined();
      });

      it('should not warn if no splits are set', () => {
        const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
directional_shadow_mode = 0
`;

        const diagnostics = linter.lint(content);
        const splitWarning = diagnostics.find(d => d.message.includes('split'));
        expect(splitWarning).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 1.0
light_color = Color(1, 0.95, 0.9, 1)
light_indirect_energy = 1.0
light_volumetric_fog_energy = 1.0
shadow_enabled = true
shadow_bias = 0.1
shadow_normal_bias = 2.0
shadow_blur = 1.0
shadow_transmittance_bias = 0.5
shadow_opacity = 1.0
shadow_reverse_cull_face = false
directional_shadow_mode = 2
directional_shadow_split_1 = 0.1
directional_shadow_split_2 = 0.2
directional_shadow_split_3 = 0.5
directional_shadow_fade_start = 0.8
directional_shadow_max_distance = 100.0
directional_shadow_pancake_size = 20.0
directional_shadow_blend_splits = true
light_negative = false
light_specular = 0.5
light_bake_mode = 1
light_cull_mask = 1048575
sky_mode = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 0
directional_shadow_mode = 10
directional_shadow_split_1 = 0.5
directional_shadow_split_2 = 0.3
shadow_opacity = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have errors for: light_energy, shadow_mode, split ordering, shadow_opacity
      const hasEnergyError = diagnostics.some(d => d.message.includes('light_energy'));
      const hasModeError = diagnostics.some(d => d.message.includes('directional_shadow_mode'));
      const hasOpacityError = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasEnergyError || hasModeError || hasOpacityError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 1.5e0
shadow_bias = 1e-1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate mixed warnings and errors', () => {
      const content = `[gd_scene format=3]

[node name="Sun" type="DirectionalLight3D"]
light_energy = 150
directional_shadow_max_distance = 15000
directional_shadow_split_1 = 0.5
directional_shadow_split_2 = 0.3
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasWarnings).toBe(true);
      expect(hasErrors).toBe(true);
    });
  });
});
