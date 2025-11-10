/**
 * Tests for Label3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Label3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Label3D with all properties', () => {
      const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Hello World"
pixel_size = 0.01
billboard = 1
modulate = Color(1, 1, 1, 1)
outline_size = 8
outline_modulate = Color(0, 0, 0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for minimal Label3D (only text)', () => {
      const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('text validation', () => {
      it('should accept valid quoted text', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Hello World"
`;
        const diagnostics = linter.lint(content);
        const textErrors = diagnostics.filter(d => d.message.includes('text'));
        expect(textErrors).toHaveLength(0);
      });

      it('should accept empty quoted string', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = ""
`;
        const diagnostics = linter.lint(content);
        const textErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('text'));
        expect(textErrors).toHaveLength(0);
        // Note: empty text might trigger a warning, but not an error
      });
    });

    describe('pixel_size validation', () => {
      it('should accept valid pixel_size values', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
pixel_size = 0.01
`;
        const diagnostics = linter.lint(content);
        const sizeErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('pixel_size'));
        expect(sizeErrors).toHaveLength(0);
      });

      it('should reject non-numeric pixel_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
pixel_size = invalid
`;
        const diagnostics = linter.lint(content);
        const sizeErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('pixel_size'));
        expect(sizeErrors.length).toBeGreaterThan(0);
        expect(sizeErrors[0].message).toContain('must be a number');
      });

      it('should reject negative pixel_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
pixel_size = -0.5
`;
        const diagnostics = linter.lint(content);
        const sizeErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('pixel_size'));
        expect(sizeErrors.length).toBeGreaterThan(0);
        expect(sizeErrors[0].message).toContain('greater than 0');
      });

      it('should reject zero pixel_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
pixel_size = 0
`;
        const diagnostics = linter.lint(content);
        const sizeErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('pixel_size'));
        expect(sizeErrors.length).toBeGreaterThan(0);
        expect(sizeErrors[0].message).toContain('greater than 0');
      });
    });

    describe('billboard validation', () => {
      it('should accept billboard mode 0 (disabled)', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
billboard = 0
`;
        const diagnostics = linter.lint(content);
        const billboardErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('billboard'));
        expect(billboardErrors).toHaveLength(0);
      });

      it('should accept billboard mode 1 (enabled)', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
billboard = 1
`;
        const diagnostics = linter.lint(content);
        const billboardErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('billboard'));
        expect(billboardErrors).toHaveLength(0);
      });

      it('should accept billboard mode 2 (Y-axis only)', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
billboard = 2
`;
        const diagnostics = linter.lint(content);
        const billboardErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('billboard'));
        expect(billboardErrors).toHaveLength(0);
      });

      it('should reject billboard mode 3 (particles mode not supported)', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
billboard = 3
`;
        const diagnostics = linter.lint(content);
        const billboardErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('billboard'));
        expect(billboardErrors.length).toBeGreaterThan(0);
        expect(billboardErrors[0].message).toContain('must be 0-2');
      });

      it('should reject invalid billboard mode', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
billboard = 5
`;
        const diagnostics = linter.lint(content);
        const billboardErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('billboard'));
        expect(billboardErrors.length).toBeGreaterThan(0);
        expect(billboardErrors[0].message).toContain('must be 0-2');
      });

      it('should reject non-numeric billboard', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
billboard = invalid
`;
        const diagnostics = linter.lint(content);
        const billboardErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('billboard'));
        expect(billboardErrors.length).toBeGreaterThan(0);
        expect(billboardErrors[0].message).toContain('must be a number');
      });
    });

    describe('modulate validation', () => {
      it('should accept valid Color format', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
modulate = Color(1, 0.5, 0, 1)
`;
        const diagnostics = linter.lint(content);
        const modulateErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('modulate'));
        expect(modulateErrors).toHaveLength(0);
      });

      it('should reject invalid Color format', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
modulate = RGB(255, 128, 0)
`;
        const diagnostics = linter.lint(content);
        const modulateErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('modulate'));
        expect(modulateErrors.length).toBeGreaterThan(0);
        expect(modulateErrors[0].message).toContain('Color(');
      });
    });

    describe('outline_size validation', () => {
      it('should accept valid outline_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
outline_size = 8
`;
        const diagnostics = linter.lint(content);
        const outlineErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('outline_size'));
        expect(outlineErrors).toHaveLength(0);
      });

      it('should accept zero outline_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
outline_size = 0
`;
        const diagnostics = linter.lint(content);
        const outlineErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('outline_size'));
        expect(outlineErrors).toHaveLength(0);
      });

      it('should reject non-numeric outline_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
outline_size = invalid
`;
        const diagnostics = linter.lint(content);
        const outlineErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('outline_size'));
        expect(outlineErrors.length).toBeGreaterThan(0);
        expect(outlineErrors[0].message).toContain('must be a number');
      });

      it('should reject negative outline_size', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
outline_size = -5
`;
        const diagnostics = linter.lint(content);
        const outlineErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('outline_size'));
        expect(outlineErrors.length).toBeGreaterThan(0);
        expect(outlineErrors[0].message).toContain('must be >= 0');
      });
    });

    describe('outline_modulate validation', () => {
      it('should accept valid Color format', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
outline_modulate = Color(0, 0, 0, 1)
`;
        const diagnostics = linter.lint(content);
        const outlineErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('outline_modulate'));
        expect(outlineErrors).toHaveLength(0);
      });

      it('should reject invalid Color format', () => {
        const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
outline_modulate = invalid
`;
        const diagnostics = linter.lint(content);
        const outlineErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('outline_modulate'));
        expect(outlineErrors.length).toBeGreaterThan(0);
        expect(outlineErrors[0].message).toContain('Color(');
      });
    });
  });

  describe('Semantic Validation Rules', () => {
    it('should warn when text is empty', () => {
      const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = ""
`;
      const diagnostics = linter.lint(content);
      const warnings = diagnostics.filter(d => d.severity === 'warning' && d.message.includes('empty'));
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should warn when pixel_size is very large', () => {
      const content = `[gd_scene format=3]

[node name="Label" type="Label3D"]
text = "Test"
pixel_size = 2.0
`;
      const diagnostics = linter.lint(content);
      const warnings = diagnostics.filter(d => d.severity === 'warning' && d.message.includes('pixel_size'));
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('very large');
    });
  });
});
