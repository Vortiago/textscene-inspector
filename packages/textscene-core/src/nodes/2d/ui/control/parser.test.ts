import { describe, expect, it } from 'vitest';
import { parseControl } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseControl', () => {
  it('parses anchors_preset and layout_mode', () => {
    const p = parseControl(heading('Control', { name: 'Bg' }), {
      anchors_preset: '15',
      layout_mode: '1',
    });
    expect(p.anchorsPreset).toBe(15);
    expect(p.layoutMode).toBe(1);
  });

  it('parses explicit anchors and offsets', () => {
    const p = parseControl(heading('Control', { name: 'P' }), {
      anchor_left: '1.0',
      offset_left: '-220',
      offset_top: '10',
    });
    expect(p.anchorLeft).toBe(1);
    expect(p.offsetLeft).toBe(-220);
    expect(p.offsetTop).toBe(10);
  });

  it('collects theme overrides into typed maps', () => {
    const p = parseControl(heading('Control', { name: 'L' }), {
      'theme_override_constants/separation': '6',
      'theme_override_font_sizes/font_size': '18',
      'theme_override_colors/font_color': 'Color(0.2, 0.18, 0.12, 1)',
      'theme_override_styles/panel': 'SubResource("StyleBoxFlat_1")',
    });
    expect(p.themeOverrideConstants?.separation).toBe(6);
    expect(p.themeOverrideFontSizes?.font_size).toBe(18);
    expect(p.themeOverrideColors?.font_color?.r).toBeCloseTo(0.2, 5);
    expect(p.themeOverrideStyles?.panel).toBe('SubResource("StyleBoxFlat_1")');
  });

  it('parses custom_minimum_size and size flags', () => {
    const p = parseControl(heading('Control', { name: 'B' }), {
      custom_minimum_size: 'Vector2(120, 40)',
      size_flags_horizontal: '3',
    });
    expect(p.customMinimumSize).toEqual({ x: 120, y: 40 });
    expect(p.sizeFlagsHorizontal).toBe(3);
  });

  it('captures visibility', () => {
    const p = parseControl(heading('Control', { name: 'C' }), { visible: 'false' });
    expect(p.visible).toBe(false);
  });

  describe('CanvasItem draw-order + sampler properties', () => {
    it('parses explicit z_index, show_behind_parent, light_mask, texture_filter, texture_repeat', () => {
      const p = parseControl(heading('Control', { name: 'Badge' }), {
        z_index: '3',
        show_behind_parent: 'true',
        light_mask: '3',
        texture_filter: '2',
        texture_repeat: '1',
      });
      expect(p.zIndex).toBe(3);
      expect(p.showBehindParent).toBe(true);
      expect(p.lightMask).toBe(3);
      expect(p.textureFilter).toBe(2);
      expect(p.textureRepeat).toBe(1);
    });

    it('defaults to Godot values when absent (scene/main/canvas_item.h:98,101,113,123-124)', () => {
      const p = parseControl(heading('Control', { name: 'Plain' }), {});
      // z_index (canvas_item.h:101): `int z_index = 0;`
      expect(p.zIndex).toBe(0);
      // show_behind_parent (canvas_item.h:113): `bool behind = false;`
      expect(p.showBehindParent).toBe(false);
      // light_mask (canvas_item.h:98): `int light_mask = 1;`
      expect(p.lightMask).toBe(1);
      // texture_filter (canvas_item.h:123): `TextureFilter texture_filter = TEXTURE_FILTER_PARENT_NODE;` (0)
      expect(p.textureFilter).toBe(0);
      // texture_repeat (canvas_item.h:124): `TextureRepeat texture_repeat = TEXTURE_REPEAT_PARENT_NODE;` (0)
      expect(p.textureRepeat).toBe(0);
    });
  });
});
