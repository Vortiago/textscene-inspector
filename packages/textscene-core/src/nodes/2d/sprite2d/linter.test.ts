/**
 * Tests for Sprite2D linter (strict parser + semantic rules)
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

/**
 * Resource definitions appended to accept-case scenes so the required `texture`
 * resolves and the `sprite2d-requires-texture` rule stays quiet. Carries both a
 * SubResource (`tex_1`) and an ExtResource (`ext_1`) so either reference form lints clean.
 */
const resources = [
  '[ext_resource type="Texture2D" path="res://icon.png" id="ext_1"]',
  '[sub_resource type="Texture2D" id="tex_1"]',
].join('\n\n');

/** A valid texture reference, added to accept nodes that test non-texture properties. */
const tex = { texture: 'SubResource("tex_1")' };

describe('Sprite2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Sprite2D properties', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'ExtResource("texture_1")',
            centered: true,
            offset: 'Vector2(0, 0)',
          }),
          '[ext_resource type="Texture2D" path="res://icon.png" id="texture_1"]'
        )
      );
    });

    runPropertyValidation({ nodeType: 'Sprite2D', acceptChild: resources, baseProps: tex }, [
      {
        prop: 'texture',
        valid: ['SubResource("tex_1")', 'ExtResource("ext_1")'],
        invalid: [
          { value: '"invalid_format"', contains: ['texture', 'resource reference'] },
          { value: 'res://icon.png', contains: ['texture'] },
        ],
      },
      {
        prop: 'centered',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['centered', 'boolean'] }],
      },
      {
        prop: 'offset',
        valid: ['Vector2(10, 20)', 'Vector2(-10, -20)', 'Vector2(10.5, 20.75)'],
        invalid: [{ value: '"10, 20"', contains: ['offset', 'Vector2'] }],
      },
      {
        prop: 'flip_h',
        valid: [true],
        invalid: [{ value: 1, contains: ['flip_h', 'boolean'] }],
      },
      {
        prop: 'flip_v',
        valid: [false],
        invalid: [{ value: 'yes', contains: ['flip_v', 'boolean'] }],
      },
      {
        prop: 'region_enabled',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['region_enabled', 'boolean'] }],
      },
      {
        prop: 'region_rect',
        valid: ['Rect2(0, 0, 100, 100)', 'Rect2(-10, -10, 100, 100)', 'Rect2(0.5, 0.5, 100.5, 100.5)'],
        with: { region_enabled: true },
        invalid: [{ value: '"0, 0, 100, 100"', contains: ['region_rect', 'Rect2'] }],
      },
      {
        prop: 'hframes',
        valid: [4, 16384],
        invalid: [
          { value: 0, contains: ['hframes', 'integer 1-16384'] },
          { value: -1, contains: ['hframes', 'integer 1-16384'] },
        ],
      },
      {
        prop: 'vframes',
        valid: [4, 16384],
        invalid: [
          { value: 0, contains: ['vframes', 'integer 1-16384'] },
          { value: -1, contains: ['vframes', 'integer 1-16384'] },
        ],
      },
      {
        prop: 'frame',
        valid: [5, 0],
        with: { hframes: 3, vframes: 2 },
        invalid: [
          { value: -1, contains: ['frame', 'non-negative'] },
          { value: 1.5, contains: ['frame'] },
        ],
      },
      {
        prop: 'frame_coords',
        valid: ['Vector2i(1, 2)', 'Vector2i(0, 0)'],
        with: { hframes: 4, vframes: 3 },
        invalid: [
          { value: 'Vector2i(-1, 0)', contains: ['frame_coords', 'non-negative'] },
          { value: 'Vector2(1, 2)', contains: ['frame_coords', 'Vector2i'] },
          { value: 'Vector2i(1.5, 2.5)', contains: ['frame_coords'] },
        ],
      },
    ]);

    describe('ADR-0032 tiering: enforced floor, hinted ceiling', () => {
      // set_hframes ERR_FAIL_COND_MSGs below 1 (sprite_2d.cpp:323); nothing
      // enforces the 16384 hint (sprite_2d.cpp:543) but the format is real.
      it('errors below the enforced hframes floor', () => {
        expectDiagnostic(scene(node('Sprite2D', { hframes: 0 })), {
          prop: 'hframes',
          severity: 'error',
        });
      });

      it('warns above the hinted hframes ceiling', () => {
        expectDiagnostic(scene(node('Sprite2D', { hframes: 20000 })), {
          prop: 'hframes',
          severity: 'warning',
        });
      });

      it('warns above the hinted vframes ceiling', () => {
        expectDiagnostic(scene(node('Sprite2D', { vframes: 20000 })), {
          prop: 'vframes',
          severity: 'warning',
        });
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing texture (REQUIRED)', () => {
      expectDiagnostic(scene(node('Sprite2D', { centered: true })), {
        ruleName: 'sprite2d-requires-texture',
        severity: 'warning',
        nodeType: 'Sprite2D',
        contains: ["requires a 'texture' property"],
      });
    });

    it('should detect missing texture resource', () => {
      const diagnostics = lint(
        scene(node('Sprite2D', { texture: 'SubResource("nonexistent")' }, { name: 'MissingTexture' }))
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingTexture',
        nodeType: 'Sprite2D',
        ruleName: 'valid-sprite2d-resources',
      });
      expect(diagnostics[0]!.message).toContain('Texture resource not found');
    });

    it('should pass when texture resource exists (SubResource)', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")' }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should pass when texture is external resource', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'ExtResource("tex_1")' }),
          '[ext_resource type="Texture2D" path="res://icon.png" id="tex_1"]'
        )
      );
    });
  });

  describe('Semantic Validation (Frame Range)', () => {
    it('should detect frame out of range (frame >= hframes * vframes)', () => {
      expectDiagnostic(scene(node('Sprite2D', { hframes: 4, vframes: 3, frame: 12 })), {
        ruleName: 'sprite2d-frame-range',
        severity: 'error',
        nodeType: 'Sprite2D',
        contains: ['out of range', 'Maximum frame is 11'],
      });
    });

    it('should pass when frame is within valid range', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")', hframes: 4, vframes: 3, frame: 11 }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should pass when frame is 0 and hframes/vframes are 1 (default)', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")', frame: 0 }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should detect frame out of range with single frame', () => {
      expectDiagnostic(scene(node('Sprite2D', { frame: 1 })), {
        ruleName: 'sprite2d-frame-range',
        contains: ['out of range'],
      });
    });

    it('should pass when frame equals hframes * vframes - 1', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")', hframes: 2, vframes: 2, frame: 3 }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });
  });

  describe('Semantic Validation (Frame Coords Range)', () => {
    it('should detect frame_coords.x out of range', () => {
      expectDiagnostic(scene(node('Sprite2D', { hframes: 4, frame_coords: 'Vector2i(4, 0)' })), {
        ruleName: 'sprite2d-frame-coords-range',
        severity: 'error',
        nodeType: 'Sprite2D',
        contains: ['frame_coords.x', 'out of range'],
      });
    });

    it('should detect frame_coords.y out of range', () => {
      expectDiagnostic(scene(node('Sprite2D', { vframes: 3, frame_coords: 'Vector2i(0, 3)' })), {
        ruleName: 'sprite2d-frame-coords-range',
        severity: 'error',
        nodeType: 'Sprite2D',
        contains: ['frame_coords.y', 'out of range'],
      });
    });

    it('should detect both frame_coords out of range', () => {
      const diagnostics = lint(
        scene(node('Sprite2D', { hframes: 2, vframes: 2, frame_coords: 'Vector2i(2, 2)' }))
      );
      expect(diagnostics.length).toBeGreaterThan(1);
      const coordErrors = diagnostics.filter(d => d.ruleName === 'sprite2d-frame-coords-range');
      expect(coordErrors).toHaveLength(2);
    });

    it('should pass when frame_coords is within range', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            hframes: 4,
            vframes: 3,
            frame_coords: 'Vector2i(3, 2)',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });
  });

  describe('Semantic Validation (Region Configuration)', () => {
    it('should warn when region_rect is set without region_enabled', () => {
      expectDiagnostic(scene(node('Sprite2D', { region_rect: 'Rect2(0, 0, 100, 100)' })), {
        ruleName: 'sprite2d-region-configuration',
        severity: 'warning',
        nodeType: 'Sprite2D',
        contains: ['region_enabled', 'ignored'],
      });
    });

    it('should warn when region_rect is set but region_enabled is false', () => {
      expectDiagnostic(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            region_enabled: false,
            region_rect: 'Rect2(0, 0, 100, 100)',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        ),
        {
          ruleName: 'sprite2d-region-configuration',
          severity: 'warning',
          nodeType: 'Sprite2D',
          contains: ["'region_enabled' is false"],
        }
      );
    });

    it('should pass when region_rect is set with region_enabled true', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            region_enabled: true,
            region_rect: 'Rect2(0, 0, 100, 100)',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should pass when region_enabled is true without region_rect', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")', region_enabled: true }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(node('Sprite2D', { centered: 1, hframes: 0, vframes: -1, frame: -5, flip_h: 'yes' }))
      );
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            centered: true,
            offset: 'Vector2(10, 20)',
            flip_h: true,
            flip_v: false,
            region_enabled: true,
            region_rect: 'Rect2(0, 0, 64, 64)',
            hframes: 4,
            vframes: 3,
            frame: 5,
            frame_coords: 'Vector2i(1, 1)',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should handle node with no properties', () => {
      expectDiagnostic(scene(node('Sprite2D')), {
        ruleName: 'sprite2d-requires-texture',
        contains: ["requires a 'texture' property"],
      });
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            offset: 'Vector2(1.5e2, 2.0e1)',
            region_enabled: true,
            region_rect: 'Rect2(0, 0, 1e2, 1e2)',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should handle boolean properties with proper values', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            centered: true,
            flip_h: false,
            flip_v: true,
            region_enabled: false,
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should handle sprite sheet with maximum valid frame', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")', hframes: 8, vframes: 8, frame: 63 }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should handle large hframes and vframes values', () => {
      expectClean(
        scene(
          node('Sprite2D', { texture: 'SubResource("tex_1")', hframes: 100, vframes: 100, frame: 9999 }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should validate both frame and frame_coords independently', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            hframes: 4,
            vframes: 3,
            frame: 5,
            frame_coords: 'Vector2i(1, 1)',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });

    it('should handle whitespace in Vector2 and Rect2', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("tex_1")',
            offset: 'Vector2(  10  ,  20  )',
            region_enabled: true,
            region_rect: 'Rect2(  0  ,  0  ,  100  ,  100  )',
          }),
          '[sub_resource type="Texture2D" id="tex_1"]'
        )
      );
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete sprite sheet configuration', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'ExtResource("spritesheet")',
            centered: true,
            hframes: 8,
            vframes: 4,
            frame: 0,
            frame_coords: 'Vector2i(0, 0)',
          }),
          '[ext_resource type="Texture2D" path="res://spritesheet.png" id="spritesheet"]'
        )
      );
    });

    it('should validate complete region configuration', () => {
      expectClean(
        scene(
          node('Sprite2D', {
            texture: 'ExtResource("atlas")',
            centered: false,
            offset: 'Vector2(16, 16)',
            region_enabled: true,
            region_rect: 'Rect2(32, 64, 32, 32)',
          }),
          '[ext_resource type="Texture2D" path="res://atlas.png" id="atlas"]'
        )
      );
    });

    it('should catch multiple semantic errors in complex scene', () => {
      const diagnostics = lint(
        scene(
          node('Sprite2D', {
            texture: 'SubResource("missing_texture")',
            hframes: 4,
            vframes: 3,
            frame: 20,
            frame_coords: 'Vector2i(5, 5)',
            region_rect: 'Rect2(0, 0, 100, 100)',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(2);
      expect(diagnostics.some(d => d.message.includes('Texture resource not found'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('frame') && d.message.includes('out of range'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('region_rect') && d.message.includes('ignored'))).toBe(true);
    });
  });
});
