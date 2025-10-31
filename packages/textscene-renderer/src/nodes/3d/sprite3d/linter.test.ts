/**
 * Tests for Sprite3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Sprite3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Sprite3D properties', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="texture_1"]

[node name="ValidSprite" type="Sprite3D"]
texture = ExtResource("texture_1")
billboard = 1
pixel_size = 0.01
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('texture validation', () => {
      it('should accept valid texture reference format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidTexture" type="Sprite3D"]
texture = SubResource("tex_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid texture format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidTexture" type="Sprite3D"]
texture = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('texture');
        expect(diagnostics[0].message).toContain('resource reference');
      });
    });

    describe('billboard validation', () => {
      it('should validate all valid billboard values', () => {
        const validValues = [0, 1, 2, 3]; // DISABLED, ENABLED, FIXED_Y, PARTICLES

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidBillboard${value}" type="Sprite3D"]
texture = SubResource("tex_1")
billboard = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid billboard value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidBillboard" type="Sprite3D"]
billboard = 99
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('billboard');
        expect(diagnostics[0].message).toContain('0-3');
      });

      it('should reject negative billboard value', () => {
        const content = `[gd_scene format=3]

[node name="NegativeBillboard" type="Sprite3D"]
billboard = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('billboard');
      });
    });

    describe('alpha_cut validation', () => {
      it('should validate all valid alpha_cut values', () => {
        const validValues = [0, 1, 2]; // DISABLED, DISCARD, OPAQUE_PREPASS

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidAlphaCut${value}" type="Sprite3D"]
texture = SubResource("tex_1")
alpha_cut = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid alpha_cut value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAlphaCut" type="Sprite3D"]
alpha_cut = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('alpha_cut');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('axis validation', () => {
      it('should validate all valid axis values', () => {
        const validValues = [0, 1, 2]; // X_AXIS, Y_AXIS, Z_AXIS

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidAxis${value}" type="Sprite3D"]
texture = SubResource("tex_1")
axis = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid axis value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidAxis" type="Sprite3D"]
axis = 10
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('axis');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('pixel_size validation', () => {
      it('should accept valid positive pixel_size', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidPixelSize" type="Sprite3D"]
texture = SubResource("tex_1")
pixel_size = 0.01
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero pixel_size', () => {
        const content = `[gd_scene format=3]

[node name="ZeroPixelSize" type="Sprite3D"]
pixel_size = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pixel_size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative pixel_size', () => {
        const content = `[gd_scene format=3]

[node name="NegativePixelSize" type="Sprite3D"]
pixel_size = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pixel_size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });
    });

    describe('transparency validation', () => {
      it('should accept valid transparency values', () => {
        const validValues = [0, 0.5, 1];

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidTransparency${value}" type="Sprite3D"]
texture = SubResource("tex_1")
transparency = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject transparency less than 0', () => {
        const content = `[gd_scene format=3]

[node name="NegativeTransparency" type="Sprite3D"]
transparency = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('transparency');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject transparency greater than 1', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveTransparency" type="Sprite3D"]
transparency = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('transparency');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('hframes and vframes validation', () => {
      it('should accept valid hframes', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidHFrames" type="Sprite3D"]
texture = SubResource("tex_1")
hframes = 4
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero hframes', () => {
        const content = `[gd_scene format=3]

[node name="ZeroHFrames" type="Sprite3D"]
hframes = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('hframes');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative hframes', () => {
        const content = `[gd_scene format=3]

[node name="NegativeHFrames" type="Sprite3D"]
hframes = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('hframes');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should accept valid vframes', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidVFrames" type="Sprite3D"]
texture = SubResource("tex_1")
vframes = 4
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero vframes', () => {
        const content = `[gd_scene format=3]

[node name="ZeroVFrames" type="Sprite3D"]
vframes = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('vframes');
        expect(diagnostics[0].message).toContain('greater than 0');
      });
    });

    describe('frame validation', () => {
      it('should accept valid non-negative frame', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidFrame" type="Sprite3D"]
texture = SubResource("tex_1")
hframes = 3
vframes = 2
frame = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative frame', () => {
        const content = `[gd_scene format=3]

[node name="NegativeFrame" type="Sprite3D"]
frame = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('offset validation', () => {
      it('should accept valid Vector2 offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidOffset" type="Sprite3D"]
texture = SubResource("tex_1")
offset = Vector2(10, 20)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative offset values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="NegativeOffset" type="Sprite3D"]
texture = SubResource("tex_1")
offset = Vector2(-10, -20)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid offset format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidOffset" type="Sprite3D"]
offset = "10, 20"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('offset');
        expect(diagnostics[0].message).toContain('Vector2');
      });
    });

    describe('frame_coords validation', () => {
      it('should accept valid Vector2i frame_coords', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidFrameCoords" type="Sprite3D"]
texture = SubResource("tex_1")
frame_coords = Vector2i(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid frame_coords format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFrameCoords" type="Sprite3D"]
frame_coords = Vector2(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame_coords');
        expect(diagnostics[0].message).toContain('Vector2i');
      });
    });

    describe('region_rect validation', () => {
      it('should accept valid Rect2 region_rect', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidRegion" type="Sprite3D"]
texture = SubResource("tex_1")
region_enabled = true
region_rect = Rect2(0, 0, 100, 100)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid region_rect format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidRegion" type="Sprite3D"]
region_rect = "0, 0, 100, 100"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('region_rect');
        expect(diagnostics[0].message).toContain('Rect2');
      });
    });

    describe('modulate validation', () => {
      it('should accept valid Color modulate', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidModulate" type="Sprite3D"]
texture = SubResource("tex_1")
modulate = Color(1, 0.5, 0, 1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid modulate format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidModulate" type="Sprite3D"]
modulate = "red"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('modulate');
        expect(diagnostics[0].message).toContain('Color');
      });
    });

    describe('render_priority validation', () => {
      it('should accept valid render_priority', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidPriority" type="Sprite3D"]
texture = SubResource("tex_1")
render_priority = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative render_priority', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="NegativePriority" type="Sprite3D"]
texture = SubResource("tex_1")
render_priority = -10
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing texture (REQUIRED)', () => {
      const content = `[gd_scene format=3]

[node name="NoTexture" type="Sprite3D"]
billboard = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const textureError = diagnostics.find(d => d.message.includes('requires a \'texture\' property'));
      expect(textureError).toBeDefined();
      expect(textureError?.severity).toBe('error');
      expect(textureError?.ruleName).toBe('sprite3d-requires-texture');
    });

    it('should detect missing texture resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingTexture" type="Sprite3D"]
texture = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingTexture',
        nodeType: 'Sprite3D',
        ruleName: 'valid-sprite3d-resources',
      });
      expect(diagnostics[0].message).toContain('Texture resource not found');
    });

    it('should pass when texture resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidSprite" type="Sprite3D"]
texture = SubResource("tex_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when texture is external resource', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="tex_1"]

[node name="ValidSprite" type="Sprite3D"]
texture = ExtResource("tex_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Frame Range)', () => {
    it('should detect frame out of range (frame >= hframes * vframes)', () => {
      const content = `[gd_scene format=3]

[node name="FrameOutOfRange" type="Sprite3D"]
hframes = 4
vframes = 3
frame = 12
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const frameError = diagnostics.find(d => d.ruleName === 'sprite3d-frame-range');
      expect(frameError).toBeDefined();
      expect(frameError?.severity).toBe('warning');
      expect(frameError?.message).toContain('out of range');
      expect(frameError?.message).toContain('Maximum frame is 11');
    });

    it('should pass when frame is within valid range', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidFrame" type="Sprite3D"]
texture = SubResource("tex_1")
hframes = 4
vframes = 3
frame = 11
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when frame is 0 and hframes/vframes are 1 (default)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="DefaultFrames" type="Sprite3D"]
texture = SubResource("tex_1")
frame = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect frame out of range with single frame', () => {
      const content = `[gd_scene format=3]

[node name="FrameTooHigh" type="Sprite3D"]
frame = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const frameError = diagnostics.find(d => d.ruleName === 'sprite3d-frame-range');
      expect(frameError).toBeDefined();
      expect(frameError?.message).toContain('out of range');
    });
  });

  describe('Semantic Validation (Region Configuration)', () => {
    it('should warn when region_rect is set without region_enabled', () => {
      const content = `[gd_scene format=3]

[node name="RegionNoEnabled" type="Sprite3D"]
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const regionError = diagnostics.find(d => d.ruleName === 'sprite3d-region-configuration');
      expect(regionError).toBeDefined();
      expect(regionError?.severity).toBe('warning');
      expect(regionError?.message).toContain('region_enabled');
      expect(regionError?.message).toContain('ignored');
    });

    it('should warn when region_rect is set but region_enabled is false', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="RegionDisabled" type="Sprite3D"]
texture = SubResource("tex_1")
region_enabled = false
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const regionError = diagnostics.find(d => d.ruleName === 'sprite3d-region-configuration');
      expect(regionError).toBeDefined();
      expect(regionError?.severity).toBe('warning');
      expect(regionError?.message).toContain("'region_enabled' is false");
    });

    it('should pass when region_rect is set with region_enabled true', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidRegion" type="Sprite3D"]
texture = SubResource("tex_1")
region_enabled = true
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Axis Usage)', () => {
    it('should warn when axis is set without FIXED_Y billboard mode', () => {
      const content = `[gd_scene format=3]

[node name="AxisWithoutFixedY" type="Sprite3D"]
billboard = 1
axis = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const axisError = diagnostics.find(d => d.ruleName === 'sprite3d-axis-usage');
      expect(axisError).toBeDefined();
      expect(axisError?.severity).toBe('warning');
      expect(axisError?.message).toContain('axis');
      expect(axisError?.message).toContain('FIXED_Y');
    });

    it('should pass when axis is set with FIXED_Y billboard mode', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidAxisUsage" type="Sprite3D"]
texture = SubResource("tex_1")
billboard = 2
axis = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when axis is set without billboard property', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="AxisOnly" type="Sprite3D"]
texture = SubResource("tex_1")
axis = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="Sprite3D"]
billboard = 99
alpha_cut = 10
pixel_size = -1
hframes = 0
vframes = -1
frame = -5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="CompleteSprite" type="Sprite3D"]
texture = SubResource("tex_1")
billboard = 2
alpha_cut = 1
axis = 1
pixel_size = 0.01
transparency = 0.8
hframes = 4
vframes = 3
frame = 5
offset = Vector2(10, 20)
frame_coords = Vector2i(1, 1)
region_enabled = true
region_rect = Rect2(0, 0, 64, 64)
modulate = Color(1, 1, 1, 1)
render_priority = 0
shaded = true
double_sided = false
no_depth_test = false
fixed_size = false
flip_h = false
flip_v = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptySprite" type="Sprite3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const textureError = diagnostics.find(d => d.message.includes('requires a \'texture\' property'));
      expect(textureError).toBeDefined();
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ScientificNotation" type="Sprite3D"]
texture = SubResource("tex_1")
pixel_size = 1e-3
transparency = 5.5e-1
offset = Vector2(1.5e2, 2.0e1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boolean properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="BoolProperties" type="Sprite3D"]
texture = SubResource("tex_1")
shaded = true
double_sided = false
no_depth_test = true
fixed_size = false
flip_h = true
flip_v = false
region_enabled = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
