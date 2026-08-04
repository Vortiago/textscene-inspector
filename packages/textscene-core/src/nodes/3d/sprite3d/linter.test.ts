/**
 * Tests for Sprite3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A texture the node can reference so the `sprite3d-requires-texture` rule stays quiet. */
const textureRef = 'SubResource("tex_1")';
/** The matching sub_resource definition, appended so the texture reference resolves. */
const textureDef = '[sub_resource type="Texture2D" id="tex_1"]';
/** Accept-case props giving the node a valid, existing texture. */
const withTexture = { texture: textureRef };

describe('Sprite3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Sprite3D properties', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="texture_1"]

[node name="ValidSprite" type="Sprite3D"]
texture = ExtResource("texture_1")
billboard = 1
pixel_size = 0.01
`);
    });

    runPropertyValidation({ nodeType: 'Sprite3D', acceptChild: textureDef, baseProps: withTexture }, [
      {
        prop: 'texture',
        valid: [textureRef],
        invalid: [{ value: '"invalid_format"', contains: ['texture', 'resource reference'] }],
      },
      {
        // sprite_3d.cpp:685 hints only 3 labels, and set_billboard_mode:598
        // ERR_FAIL_INDEX(p_mode, 3) explicitly excludes BILLBOARD_PARTICLES
        // (StandardMaterial3D's 4th value) — 3 is not a legal Sprite3D value.
        prop: 'billboard',
        valid: [0, 1, 2],
        invalid: [
          { value: 3, contains: ['billboard', '0-2'] },
          { value: 99, contains: ['billboard', '0-2'] },
          { value: -1, contains: ['billboard'] },
        ],
      },
      {
        // sprite_3d.cpp:691 hints 4 labels; ALPHA_CUT_HASH=3 is real and
        // enforced-accepted (ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX), :531).
        prop: 'alpha_cut',
        valid: [0, 1, 2, 3],
        invalid: [{ value: 5, contains: ['alpha_cut', '0-3'] }],
      },
      {
        prop: 'axis',
        valid: [0, 1, 2],
        invalid: [{ value: 10, contains: ['axis', '0-2'] }],
      },
      {
        prop: 'pixel_size',
        valid: [0.01],
        invalid: [
          { value: 0, contains: ['pixel_size', 'greater than 0'] },
          { value: -0.5, contains: ['pixel_size', 'greater than 0'] },
        ],
      },
      {
        prop: 'transparency',
        valid: [0, 0.5, 1],
        invalid: [
          { value: -0.5, contains: ['transparency', 'between 0 and 1'] },
          { value: 1.5, contains: ['transparency', 'between 0 and 1'] },
        ],
      },
      {
        prop: 'hframes',
        valid: [4],
        invalid: [
          { value: 0, contains: ['hframes', 'greater than 0'] },
          { value: -1, contains: ['hframes', 'greater than 0'] },
        ],
      },
      {
        prop: 'vframes',
        valid: [4],
        invalid: [{ value: 0, contains: ['vframes', 'greater than 0'] }],
      },
      {
        prop: 'frame',
        valid: [5],
        with: { hframes: 3, vframes: 2 },
        invalid: [{ value: -1, contains: ['frame', 'non-negative'] }],
      },
      {
        prop: 'offset',
        valid: ['Vector2(10, 20)', 'Vector2(-10, -20)'],
        invalid: [{ value: '"10, 20"', contains: ['offset', 'Vector2'] }],
      },
      {
        prop: 'frame_coords',
        valid: ['Vector2i(1, 2)'],
        invalid: [{ value: 'Vector2(1, 2)', contains: ['frame_coords', 'Vector2i'] }],
      },
      {
        prop: 'region_rect',
        valid: ['Rect2(0, 0, 100, 100)'],
        with: { region_enabled: true },
        invalid: [{ value: '"0, 0, 100, 100"', contains: ['region_rect', 'Rect2'] }],
      },
      {
        prop: 'modulate',
        valid: ['Color(1, 0.5, 0, 1)'],
        invalid: [{ value: '"red"', contains: ['modulate', 'Color'] }],
      },
      {
        prop: 'render_priority',
        valid: [5, -10],
      },
    ]);
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing texture (REQUIRED)', () => {
      expectDiagnostic(scene(node('Sprite3D', { billboard: 1 }, { name: 'NoTexture' })), {
        ruleName: 'sprite3d-requires-texture',
        severity: 'warning',
        contains: ["requires a 'texture' property"],
      });
    });

    it('should detect missing texture resource', () => {
      const diagnostics = lint(
        scene(node('Sprite3D', { texture: 'SubResource("nonexistent")' }, { name: 'MissingTexture' }))
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingTexture',
        nodeType: 'Sprite3D',
        ruleName: 'valid-sprite3d-resources',
      });
      expect(diagnostics[0]!.message).toContain('Texture resource not found');
    });

    it('should pass when texture resource exists', () => {
      expectClean(scene(node('Sprite3D', { texture: textureRef }, { name: 'ValidSprite' }), textureDef));
    });

    it('should pass when texture is external resource', () => {
      expectClean(
        scene(
          node('Sprite3D', { texture: 'ExtResource("tex_1")' }, { name: 'ValidSprite' }),
          '[ext_resource type="Texture2D" path="res://icon.png" id="tex_1"]'
        )
      );
    });
  });

  describe('Semantic Validation (Frame Range)', () => {
    it('should detect frame out of range (frame >= hframes * vframes)', () => {
      expectDiagnostic(
        scene(node('Sprite3D', { hframes: 4, vframes: 3, frame: 12 }, { name: 'FrameOutOfRange' })),
        {
          ruleName: 'sprite3d-frame-range',
          severity: 'warning',
          contains: ['out of range', 'Maximum frame is 11'],
        }
      );
    });

    it('should pass when frame is within valid range', () => {
      expectClean(
        scene(
          node('Sprite3D', { texture: textureRef, hframes: 4, vframes: 3, frame: 11 }, { name: 'ValidFrame' }),
          textureDef
        )
      );
    });

    it('should pass when frame is 0 and hframes/vframes are 1 (default)', () => {
      expectClean(
        scene(node('Sprite3D', { texture: textureRef, frame: 0 }, { name: 'DefaultFrames' }), textureDef)
      );
    });

    it('should detect frame out of range with single frame', () => {
      expectDiagnostic(scene(node('Sprite3D', { frame: 1 }, { name: 'FrameTooHigh' })), {
        ruleName: 'sprite3d-frame-range',
        contains: ['out of range'],
      });
    });
  });

  describe('Semantic Validation (Region Configuration)', () => {
    it('should warn when region_rect is set without region_enabled', () => {
      expectDiagnostic(
        scene(node('Sprite3D', { region_rect: 'Rect2(0, 0, 100, 100)' }, { name: 'RegionNoEnabled' })),
        {
          ruleName: 'sprite3d-region-configuration',
          severity: 'warning',
          contains: ['region_enabled', 'ignored'],
        }
      );
    });

    it('should warn when region_rect is set but region_enabled is false', () => {
      expectDiagnostic(
        scene(
          node(
            'Sprite3D',
            { texture: textureRef, region_enabled: false, region_rect: 'Rect2(0, 0, 100, 100)' },
            { name: 'RegionDisabled' }
          ),
          textureDef
        ),
        {
          ruleName: 'sprite3d-region-configuration',
          severity: 'warning',
          contains: ["'region_enabled' is false"],
        }
      );
    });

    it('should pass when region_rect is set with region_enabled true', () => {
      expectClean(
        scene(
          node(
            'Sprite3D',
            { texture: textureRef, region_enabled: true, region_rect: 'Rect2(0, 0, 100, 100)' },
            { name: 'ValidRegion' }
          ),
          textureDef
        )
      );
    });
  });

  describe('Semantic Validation (Axis Usage)', () => {
    it('should warn when axis is set without FIXED_Y billboard mode', () => {
      expectDiagnostic(
        scene(node('Sprite3D', { billboard: 1, axis: 1 }, { name: 'AxisWithoutFixedY' })),
        {
          ruleName: 'sprite3d-axis-usage',
          severity: 'warning',
          contains: ['axis', 'FIXED_Y'],
        }
      );
    });

    it('should pass when axis is set with FIXED_Y billboard mode', () => {
      expectClean(
        scene(
          node('Sprite3D', { texture: textureRef, billboard: 2, axis: 1 }, { name: 'ValidAxisUsage' }),
          textureDef
        )
      );
    });

    it('should pass when axis is set without billboard property', () => {
      expectClean(
        scene(node('Sprite3D', { texture: textureRef, axis: 1 }, { name: 'AxisOnly' }), textureDef)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node(
            'Sprite3D',
            { billboard: 99, alpha_cut: 10, pixel_size: -1, hframes: 0, vframes: -1, frame: -5 },
            { name: 'MultipleErrors' }
          )
        )
      );
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node(
            'Sprite3D',
            {
              texture: textureRef,
              billboard: 2,
              alpha_cut: 1,
              axis: 1,
              pixel_size: 0.01,
              transparency: 0.8,
              hframes: 4,
              vframes: 3,
              frame: 5,
              offset: 'Vector2(10, 20)',
              frame_coords: 'Vector2i(1, 1)',
              region_enabled: true,
              region_rect: 'Rect2(0, 0, 64, 64)',
              modulate: 'Color(1, 1, 1, 1)',
              render_priority: 0,
              shaded: true,
              double_sided: false,
              no_depth_test: false,
              fixed_size: false,
              flip_h: false,
              flip_v: false,
            },
            { name: 'CompleteSprite' }
          ),
          textureDef
        )
      );
    });

    it('should handle node with no properties', () => {
      expectDiagnostic(scene(node('Sprite3D', {}, { name: 'EmptySprite' })), {
        ruleName: 'sprite3d-requires-texture',
        contains: ["requires a 'texture' property"],
      });
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node(
            'Sprite3D',
            {
              texture: textureRef,
              pixel_size: '1e-3',
              transparency: '5.5e-1',
              offset: 'Vector2(1.5e2, 2.0e1)',
            },
            { name: 'ScientificNotation' }
          ),
          textureDef
        )
      );
    });

    it('should handle boolean properties', () => {
      expectClean(
        scene(
          node(
            'Sprite3D',
            {
              texture: textureRef,
              shaded: true,
              double_sided: false,
              no_depth_test: true,
              fixed_size: false,
              flip_h: true,
              flip_v: false,
              region_enabled: true,
            },
            { name: 'BoolProperties' }
          ),
          textureDef
        )
      );
    });
  });
});
