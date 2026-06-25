/**
 * Tests for Camera3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Camera3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Camera3D properties with perspective projection', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
keep_aspect = 0
cull_mask = 1048575
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid Camera3D properties with orthogonal projection', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = 10.0
near = 0.1
far = 100.0
keep_aspect = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('projection validation', () => {
      it('should accept all valid projection modes', () => {
        // Test PERSPECTIVE (0)
        let content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
`;
        let diagnostics = linter.lint(content);
        let projectionErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('projection'));
        expect(projectionErrors).toHaveLength(0);

        // Test ORTHOGONAL (1)
        content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = 10.0
near = 0.1
far = 100.0
`;
        diagnostics = linter.lint(content);
        projectionErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('projection'));
        expect(projectionErrors).toHaveLength(0);

        // Test FRUSTUM (2)
        content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 2
fov = 75.0
near = 0.1
far = 100.0
`;
        diagnostics = linter.lint(content);
        projectionErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('projection'));
        expect(projectionErrors).toHaveLength(0);
      });

      it('should reject invalid projection mode', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 5
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('projection');
        expect(diagnostics[0].message).toContain('0-2');
      });

      it('should reject non-numeric projection', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = perspective
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('projection');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('fov validation', () => {
      it('should accept valid fov values', () => {
        const validValues = [1, 45, 75, 90, 120, 179];
        for (const fov of validValues) {
          const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = ${fov}
near = 0.1
far = 100.0
`;

          const diagnostics = linter.lint(content);
          const fovErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('fov'));
          expect(fovErrors).toHaveLength(0);
        }
      });

      it('should reject fov below 1 degree', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 0.5
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('fov');
        expect(diagnostics[0].message).toContain('between 1 and 179');
      });

      it('should reject fov above 179 degrees', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 180
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('fov');
        expect(diagnostics[0].message).toContain('between 1 and 179');
      });

      it('should reject invalid fov format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = invalid
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('fov');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('size validation', () => {
      it('should accept valid size values', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = 10.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero size', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = 0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative size', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = -5.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid size format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = invalid
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('size');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('frustum_offset validation', () => {
      it('should accept valid Vector2 format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 2
frustum_offset = Vector2(0.5, -0.3)
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept Vector2 with scientific notation', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 2
frustum_offset = Vector2(1.5e-2, -3.2e1)
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid Vector2 format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 2
frustum_offset = (0.5, -0.3)
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frustum_offset');
        expect(diagnostics[0].message).toContain('Vector2');
      });

      it('should reject Vector2 with wrong number of components', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 2
frustum_offset = Vector2(0.5, -0.3, 1.0)
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frustum_offset');
      });
    });

    describe('near validation', () => {
      it('should accept valid near values', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero near', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('near');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative near', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = -0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('near');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid near format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = invalid
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('near');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('far validation', () => {
      it('should accept valid far values', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero far', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('far');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative far', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = -100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('far');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid far format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('far');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('keep_aspect validation', () => {
      it('should accept all valid keep_aspect modes', () => {
        const validModes = [0, 1, 2]; // KEEP_WIDTH, KEEP_HEIGHT, KEEP_ASPECT_DISABLED
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
keep_aspect = ${mode}
`;

          const diagnostics = linter.lint(content);
          const aspectErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('keep_aspect'));
          expect(aspectErrors).toHaveLength(0);
        }
      });

      it('should reject invalid keep_aspect mode', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
keep_aspect = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('keep_aspect');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('cull_mask validation', () => {
      it('should accept valid cull_mask values', () => {
        const validValues = [1, 100, 1048575];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
cull_mask = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject cull_mask of 0', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
cull_mask = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });

      it('should reject cull_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
cull_mask = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('cull_mask');
        expect(diagnostics[0].message).toContain('between 1 and 1048575');
      });
    });

    describe('doppler_tracking validation', () => {
      it('should accept all valid doppler_tracking modes', () => {
        const validModes = [0, 1, 2]; // DISABLED, IDLE_STEP, PHYSICS_STEP
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
doppler_tracking = ${mode}
`;

          const diagnostics = linter.lint(content);
          const dopplerErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('doppler_tracking'));
          expect(dopplerErrors).toHaveLength(0);
        }
      });

      it('should reject invalid doppler_tracking mode', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
doppler_tracking = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('doppler_tracking');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('current validation', () => {
      it('should accept valid current boolean values', () => {
        const validValues = ['true', 'false'];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
current = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid current value', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
current = yes
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('current');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('offset validation', () => {
      it('should accept valid h_offset and v_offset', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
h_offset = 0.5
v_offset = -0.25
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid h_offset format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
h_offset = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('h_offset');
        expect(diagnostics[0].message).toContain('must be a number');
      });

      it('should reject invalid v_offset format', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
v_offset = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('v_offset');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('missing required properties errors', () => {
      it('should error when fov is missing for PERSPECTIVE projection', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('fov'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('requires');
        expect(error?.message).toContain('field of view');
      });

      it('should NOT error when size is missing for ORTHOGONAL projection (Godot defaults to 1.0)', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        const sizeError = diagnostics.find(d => d.severity === 'error' && d.message.includes('size'));
        expect(sizeError).toBeUndefined();
      });

      it('should not error when fov is present for default (PERSPECTIVE) projection', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        const fovError = diagnostics.find(d => d.severity === 'error' && d.message.includes('fov'));
        expect(fovError).toBeUndefined();
      });

      it('should not error when size is present for ORTHOGONAL projection', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = 10.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        const sizeError = diagnostics.find(d => d.severity === 'error' && d.message.includes('size'));
        expect(sizeError).toBeUndefined();
      });
    });

    describe('clipping planes relationship', () => {
      it('should error when near >= far', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 100.0
far = 50.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('clipping'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('near');
        expect(error?.message).toContain('far');
        expect(error?.message).toContain('100');
        expect(error?.message).toContain('50');
      });

      it('should error when near equals far', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 100.0
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('clipping'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('must be less than');
      });

      it('should not error when near < far', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        const clippingError = diagnostics.find(d => d.severity === 'error' && d.message.includes('clipping'));
        expect(clippingError).toBeUndefined();
      });
    });

    describe('near clipping plane warnings', () => {
      it('should warn when near is very small', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.005
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('near'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very small');
        expect(warning?.message).toContain('0.005');
        expect(warning?.message).toContain('z-fighting');
      });

      it('should not warn for normal near values', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        const nearWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('near'));
        expect(nearWarning).toBeUndefined();
      });
    });

    describe('far clipping plane warnings', () => {
      it('should warn when far is very large', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 15000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('far'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very large');
        expect(warning?.message).toContain('15000');
        expect(warning?.message).toContain('precision');
      });

      it('should not warn for normal far values', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 1000
`;

        const diagnostics = linter.lint(content);
        const farWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('far'));
        expect(farWarning).toBeUndefined();
      });
    });

    describe('fov warnings', () => {
      it('should warn when fov is very narrow', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 10
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('field of view'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very narrow');
        expect(warning?.message).toContain('10');
        expect(warning?.message).toContain('tunnel vision');
      });

      it('should warn when fov is very wide', () => {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 150
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('field of view'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very wide');
        expect(warning?.message).toContain('150');
        expect(warning?.message).toContain('distortion');
      });

      it('should not warn for normal fov values', () => {
        const validFovs = [45, 60, 75, 90];
        for (const fov of validFovs) {
          const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = ${fov}
near = 0.1
far = 100.0
`;

          const diagnostics = linter.lint(content);
          const fovWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('field of view'));
          expect(fovWarning).toBeUndefined();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle Camera3D with no properties (defaults)', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
`;

      const diagnostics = linter.lint(content);
      // Should not have any required property errors since defaults are assumed
      const _requiredErrors = diagnostics.filter(d => d.severity === 'error');
      // Default projection is PERSPECTIVE (0), so fov is required
      const fovError = diagnostics.find(d => d.message.includes('fov'));
      expect(fovError).toBeDefined();
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 100.0
keep_aspect = 0
cull_mask = 1048575
doppler_tracking = 0
current = true
h_offset = 0.0
v_offset = 0.0
frustum_offset = Vector2(0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 5
fov = 200
near = -0.1
far = 0
keep_aspect = 10
cull_mask = 0
doppler_tracking = 5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(5);
      // Should have errors for: projection, fov, near, far, keep_aspect, cull_mask, doppler_tracking
      const hasProjectionError = diagnostics.some(d => d.message.includes('projection'));
      const hasFovError = diagnostics.some(d => d.message.includes('fov'));
      const hasNearError = diagnostics.some(d => d.message.includes('near'));
      const hasFarError = diagnostics.some(d => d.message.includes('far'));
      expect(hasProjectionError || hasFovError || hasNearError || hasFarError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 7.5e1
near = 1e-1
far = 1e2
h_offset = 5e-2
v_offset = -3e-1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate mixed warnings and errors', () => {
      // Test case 1: Only warnings (extreme values)
      let content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 10
near = 0.005
far = 15000
`;

      let diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme fov/near/far values
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarnings).toBe(true);

      // Test case 2: Errors from invalid values
      content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 5
fov = 200
near = -0.1
`;

      diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have errors for invalid projection, fov, and near
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      expect(hasErrors).toBe(true);
    });

    it('should handle boundary values for fov', () => {
      const boundaryValues = [1, 179];
      for (const fov of boundaryValues) {
        const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = ${fov}
near = 0.1
far = 100.0
`;

        const diagnostics = linter.lint(content);
        const fovError = diagnostics.find(d => d.severity === 'error' && d.message.includes('fov'));
        expect(fovError).toBeUndefined();
      }
    });

    it('should handle FRUSTUM projection mode', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 2
fov = 75.0
frustum_offset = Vector2(0.5, -0.3)
near = 0.1
far = 100.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle extreme combinations', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 10
near = 0.005
far = 15000
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have warnings for all extreme values
      const fovWarning = diagnostics.find(d => d.message.includes('field of view') && d.message.includes('narrow'));
      const nearWarning = diagnostics.find(d => d.message.includes('near') && d.message.includes('small'));
      const farWarning = diagnostics.find(d => d.message.includes('far') && d.message.includes('large'));
      expect(fovWarning).toBeDefined();
      expect(nearWarning).toBeDefined();
      expect(farWarning).toBeDefined();
    });

    it('should handle clipping planes at exact boundary (near = far boundary)', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
near = 0.1
far = 0.1
`;

      const diagnostics = linter.lint(content);
      const clippingError = diagnostics.find(d => d.severity === 'error' && d.message.includes('clipping'));
      expect(clippingError).toBeDefined();
    });

    it('should handle orthogonal projection with all properties', () => {
      const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
size = 20.0
near = 0.1
far = 500.0
keep_aspect = 1
cull_mask = 524287
current = true
h_offset = 1.5
v_offset = -0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
