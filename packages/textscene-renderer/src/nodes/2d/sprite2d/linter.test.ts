/**
 * Tests for Sprite2D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Sprite2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Sprite2D properties', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="texture_1"]

[node name="ValidSprite" type="Sprite2D"]
texture = ExtResource("texture_1")
centered = true
offset = Vector2(0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('texture validation', () => {
      it('should accept valid texture reference format (SubResource)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidTexture" type="Sprite2D"]
texture = SubResource("tex_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid texture reference format (ExtResource)', () => {
        const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="tex_1"]

[node name="ValidTexture" type="Sprite2D"]
texture = ExtResource("tex_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid texture format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidTexture" type="Sprite2D"]
texture = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('texture');
        expect(diagnostics[0].message).toContain('resource reference');
      });

      it('should reject plain string as texture', () => {
        const content = `[gd_scene format=3]

[node name="InvalidTexture" type="Sprite2D"]
texture = res://icon.png
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('texture');
      });
    });

    describe('centered validation', () => {
      it('should accept centered = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="CenteredTrue" type="Sprite2D"]
texture = SubResource("tex_1")
centered = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept centered = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="CenteredFalse" type="Sprite2D"]
texture = SubResource("tex_1")
centered = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid centered value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCentered" type="Sprite2D"]
centered = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('centered');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('offset validation', () => {
      it('should accept valid Vector2 offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidOffset" type="Sprite2D"]
texture = SubResource("tex_1")
offset = Vector2(10, 20)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative offset values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="NegativeOffset" type="Sprite2D"]
texture = SubResource("tex_1")
offset = Vector2(-10, -20)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept floating point offset values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="FloatOffset" type="Sprite2D"]
texture = SubResource("tex_1")
offset = Vector2(10.5, 20.75)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid offset format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidOffset" type="Sprite2D"]
offset = "10, 20"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('offset');
        expect(diagnostics[0].message).toContain('Vector2');
      });
    });

    describe('flip_h and flip_v validation', () => {
      it('should accept flip_h = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="FlipH" type="Sprite2D"]
texture = SubResource("tex_1")
flip_h = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept flip_v = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="FlipV" type="Sprite2D"]
texture = SubResource("tex_1")
flip_v = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid flip_h value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFlipH" type="Sprite2D"]
flip_h = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('flip_h');
        expect(diagnostics[0].message).toContain('boolean');
      });

      it('should reject invalid flip_v value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFlipV" type="Sprite2D"]
flip_v = yes
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('flip_v');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('region_enabled validation', () => {
      it('should accept region_enabled = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="RegionEnabled" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept region_enabled = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="RegionDisabled" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid region_enabled value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidRegionEnabled" type="Sprite2D"]
region_enabled = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('region_enabled');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('region_rect validation', () => {
      it('should accept valid Rect2 region_rect', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidRegion" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = true
region_rect = Rect2(0, 0, 100, 100)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative region_rect coordinates', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="NegativeRegion" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = true
region_rect = Rect2(-10, -10, 100, 100)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept floating point region_rect values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="FloatRegion" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = true
region_rect = Rect2(0.5, 0.5, 100.5, 100.5)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid region_rect format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidRegion" type="Sprite2D"]
region_rect = "0, 0, 100, 100"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('region_rect');
        expect(diagnostics[0].message).toContain('Rect2');
      });
    });

    describe('hframes and vframes validation', () => {
      it('should accept valid hframes', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidHFrames" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 4
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero hframes', () => {
        const content = `[gd_scene format=3]

[node name="ZeroHFrames" type="Sprite2D"]
hframes = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('hframes');
        expect(diagnostics[0].message).toContain('greater than 0');
        expect(diagnostics[0].message).toContain('division by zero');
      });

      it('should reject negative hframes', () => {
        const content = `[gd_scene format=3]

[node name="NegativeHFrames" type="Sprite2D"]
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

[node name="ValidVFrames" type="Sprite2D"]
texture = SubResource("tex_1")
vframes = 4
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero vframes', () => {
        const content = `[gd_scene format=3]

[node name="ZeroVFrames" type="Sprite2D"]
vframes = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('vframes');
        expect(diagnostics[0].message).toContain('greater than 0');
        expect(diagnostics[0].message).toContain('division by zero');
      });

      it('should reject negative vframes', () => {
        const content = `[gd_scene format=3]

[node name="NegativeVFrames" type="Sprite2D"]
vframes = -1
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

[node name="ValidFrame" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 3
vframes = 2
frame = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept frame = 0', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="FrameZero" type="Sprite2D"]
texture = SubResource("tex_1")
frame = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative frame', () => {
        const content = `[gd_scene format=3]

[node name="NegativeFrame" type="Sprite2D"]
frame = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject non-integer frame', () => {
        const content = `[gd_scene format=3]

[node name="FloatFrame" type="Sprite2D"]
frame = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame');
      });
    });

    describe('frame_coords validation', () => {
      it('should accept valid Vector2i frame_coords', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidFrameCoords" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 4
vframes = 3
frame_coords = Vector2i(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept frame_coords = Vector2i(0, 0)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ZeroFrameCoords" type="Sprite2D"]
texture = SubResource("tex_1")
frame_coords = Vector2i(0, 0)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative frame_coords', () => {
        const content = `[gd_scene format=3]

[node name="NegativeFrameCoords" type="Sprite2D"]
frame_coords = Vector2i(-1, 0)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame_coords');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject Vector2 instead of Vector2i', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFrameCoords" type="Sprite2D"]
frame_coords = Vector2(1, 2)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame_coords');
        expect(diagnostics[0].message).toContain('Vector2i');
      });

      it('should reject floating point frame_coords', () => {
        const content = `[gd_scene format=3]

[node name="FloatFrameCoords" type="Sprite2D"]
frame_coords = Vector2i(1.5, 2.5)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame_coords');
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing texture (REQUIRED)', () => {
      const content = `[gd_scene format=3]

[node name="NoTexture" type="Sprite2D"]
centered = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const textureError = diagnostics.find(d => d.message.includes('requires a \'texture\' property'));
      expect(textureError).toBeDefined();
      expect(textureError?.severity).toBe('error');
      expect(textureError?.ruleName).toBe('sprite2d-requires-texture');
    });

    it('should detect missing texture resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingTexture" type="Sprite2D"]
texture = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingTexture',
        nodeType: 'Sprite2D',
        ruleName: 'valid-sprite2d-resources',
      });
      expect(diagnostics[0].message).toContain('Texture resource not found');
    });

    it('should pass when texture resource exists (SubResource)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidSprite" type="Sprite2D"]
texture = SubResource("tex_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when texture is external resource', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="tex_1"]

[node name="ValidSprite" type="Sprite2D"]
texture = ExtResource("tex_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Frame Range)', () => {
    it('should detect frame out of range (frame >= hframes * vframes)', () => {
      const content = `[gd_scene format=3]

[node name="FrameOutOfRange" type="Sprite2D"]
hframes = 4
vframes = 3
frame = 12
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const frameError = diagnostics.find(d => d.ruleName === 'sprite2d-frame-range');
      expect(frameError).toBeDefined();
      expect(frameError?.severity).toBe('warning');
      expect(frameError?.message).toContain('out of range');
      expect(frameError?.message).toContain('Maximum frame is 11');
    });

    it('should pass when frame is within valid range', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidFrame" type="Sprite2D"]
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

[node name="DefaultFrames" type="Sprite2D"]
texture = SubResource("tex_1")
frame = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect frame out of range with single frame', () => {
      const content = `[gd_scene format=3]

[node name="FrameTooHigh" type="Sprite2D"]
frame = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const frameError = diagnostics.find(d => d.ruleName === 'sprite2d-frame-range');
      expect(frameError).toBeDefined();
      expect(frameError?.message).toContain('out of range');
    });

    it('should pass when frame equals hframes * vframes - 1', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="MaxFrame" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 2
vframes = 2
frame = 3
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Frame Coords Range)', () => {
    it('should detect frame_coords.x out of range', () => {
      const content = `[gd_scene format=3]

[node name="FrameCoordsXOutOfRange" type="Sprite2D"]
hframes = 4
frame_coords = Vector2i(4, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const coordError = diagnostics.find(d => d.ruleName === 'sprite2d-frame-coords-range');
      expect(coordError).toBeDefined();
      expect(coordError?.severity).toBe('warning');
      expect(coordError?.message).toContain('frame_coords.x');
      expect(coordError?.message).toContain('out of range');
    });

    it('should detect frame_coords.y out of range', () => {
      const content = `[gd_scene format=3]

[node name="FrameCoordsYOutOfRange" type="Sprite2D"]
vframes = 3
frame_coords = Vector2i(0, 3)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const coordError = diagnostics.find(d => d.ruleName === 'sprite2d-frame-coords-range');
      expect(coordError).toBeDefined();
      expect(coordError?.severity).toBe('warning');
      expect(coordError?.message).toContain('frame_coords.y');
      expect(coordError?.message).toContain('out of range');
    });

    it('should detect both frame_coords out of range', () => {
      const content = `[gd_scene format=3]

[node name="BothCoordsOutOfRange" type="Sprite2D"]
hframes = 2
vframes = 2
frame_coords = Vector2i(2, 2)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(1);
      const coordErrors = diagnostics.filter(d => d.ruleName === 'sprite2d-frame-coords-range');
      expect(coordErrors).toHaveLength(2);
    });

    it('should pass when frame_coords is within range', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidFrameCoords" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 4
vframes = 3
frame_coords = Vector2i(3, 2)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Region Configuration)', () => {
    it('should warn when region_rect is set without region_enabled', () => {
      const content = `[gd_scene format=3]

[node name="RegionNoEnabled" type="Sprite2D"]
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const regionError = diagnostics.find(d => d.ruleName === 'sprite2d-region-configuration');
      expect(regionError).toBeDefined();
      expect(regionError?.severity).toBe('warning');
      expect(regionError?.message).toContain('region_enabled');
      expect(regionError?.message).toContain('ignored');
    });

    it('should warn when region_rect is set but region_enabled is false', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="RegionDisabled" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = false
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const regionError = diagnostics.find(d => d.ruleName === 'sprite2d-region-configuration');
      expect(regionError).toBeDefined();
      expect(regionError?.severity).toBe('warning');
      expect(regionError?.message).toContain("'region_enabled' is false");
    });

    it('should pass when region_rect is set with region_enabled true', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ValidRegion" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = true
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when region_enabled is true without region_rect', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="EnabledNoRect" type="Sprite2D"]
texture = SubResource("tex_1")
region_enabled = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="Sprite2D"]
centered = 1
hframes = 0
vframes = -1
frame = -5
flip_h = yes
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="CompleteSprite" type="Sprite2D"]
texture = SubResource("tex_1")
centered = true
offset = Vector2(10, 20)
flip_h = true
flip_v = false
region_enabled = true
region_rect = Rect2(0, 0, 64, 64)
hframes = 4
vframes = 3
frame = 5
frame_coords = Vector2i(1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptySprite" type="Sprite2D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const textureError = diagnostics.find(d => d.message.includes('requires a \'texture\' property'));
      expect(textureError).toBeDefined();
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="ScientificNotation" type="Sprite2D"]
texture = SubResource("tex_1")
offset = Vector2(1.5e2, 2.0e1)
region_enabled = true
region_rect = Rect2(0, 0, 1e2, 1e2)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boolean properties with proper values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="BoolProperties" type="Sprite2D"]
texture = SubResource("tex_1")
centered = true
flip_h = false
flip_v = true
region_enabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle sprite sheet with maximum valid frame', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="SpriteSheet" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 8
vframes = 8
frame = 63
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle large hframes and vframes values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="LargeSpriteSheet" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 100
vframes = 100
frame = 9999
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate both frame and frame_coords independently', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="BothFrameProperties" type="Sprite2D"]
texture = SubResource("tex_1")
hframes = 4
vframes = 3
frame = 5
frame_coords = Vector2i(1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle whitespace in Vector2 and Rect2', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Texture2D" id="tex_1"]

[node name="Whitespace" type="Sprite2D"]
texture = SubResource("tex_1")
offset = Vector2(  10  ,  20  )
region_enabled = true
region_rect = Rect2(  0  ,  0  ,  100  ,  100  )
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete sprite sheet configuration', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://spritesheet.png" id="spritesheet"]

[node name="Player" type="Sprite2D"]
texture = ExtResource("spritesheet")
centered = true
hframes = 8
vframes = 4
frame = 0
frame_coords = Vector2i(0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate complete region configuration', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://atlas.png" id="atlas"]

[node name="Icon" type="Sprite2D"]
texture = ExtResource("atlas")
centered = false
offset = Vector2(16, 16)
region_enabled = true
region_rect = Rect2(32, 64, 32, 32)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should catch multiple semantic errors in complex scene', () => {
      const content = `[gd_scene format=3]

[node name="BrokenSprite" type="Sprite2D"]
texture = SubResource("missing_texture")
hframes = 4
vframes = 3
frame = 20
frame_coords = Vector2i(5, 5)
region_rect = Rect2(0, 0, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      expect(diagnostics.some(d => d.message.includes('Texture resource not found'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('frame') && d.message.includes('out of range'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('region_rect') && d.message.includes('ignored'))).toBe(true);
    });
  });
});
