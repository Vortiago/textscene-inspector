import { describe, expect, it } from 'vitest';
import { styleBoxToCss, colorToCss } from './styleBoxToCss';

describe('styleBoxToCss', () => {
  it('maps StyleBoxFlat bg_color, corner radius and border', () => {
    const css = styleBoxToCss('StyleBoxFlat', {
      bg_color: 'Color(0.76, 0.71, 0.55, 1)',
      corner_radius_top_left: '4',
      corner_radius_top_right: '4',
      corner_radius_bottom_right: '4',
      corner_radius_bottom_left: '4',
      border_width_left: '2',
      border_width_top: '2',
      border_width_right: '2',
      border_width_bottom: '2',
      border_color: 'Color(0.2, 0.18, 0.12, 1)',
    });
    expect(css.backgroundColor).toBe('rgba(194, 181, 140, 1)');
    expect(css.borderRadius).toBe('4px 4px 4px 4px');
    expect(css.borderStyle).toBe('solid');
    expect(css.borderWidth).toBe('2px 2px 2px 2px');
    expect(css.borderColor).toBe('rgba(51, 46, 31, 1)');
  });

  it('maps content margins to padding (top right bottom left)', () => {
    const css = styleBoxToCss('StyleBoxFlat', {
      content_margin_left: '10',
      content_margin_top: '6',
      content_margin_right: '10',
      content_margin_bottom: '6',
    });
    expect(css.padding).toBe('6px 10px 6px 10px');
  });

  it('returns an explicit transparent fill for StyleBoxEmpty', () => {
    // StyleBoxEmpty::draw (style_box.h:80) is empty, so the box paints nothing —
    // stated as `transparent` rather than as an absent property, which a
    // consumer default would otherwise fill in.
    expect(styleBoxToCss('StyleBoxEmpty', {})).toEqual({ backgroundColor: 'transparent' });
  });

  it('paints no fill when draw_center=false (border-only box)', () => {
    const css = styleBoxToCss('StyleBoxFlat', {
      bg_color: 'Color(0.2, 0.2, 0.2, 1)',
      draw_center: 'false',
      border_width_left: '2',
      border_color: 'Color(1, 1, 1, 1)',
    });
    expect(css.backgroundColor).toBe('transparent');
    expect(css.borderColor).toBe('rgba(255, 255, 255, 1)'); // border still drawn
  });
});

describe('styleBoxToCss parity (Godot defaults)', () => {
  it('content_margin falls back to border_width per side when absent (#8)', () => {
    // Godot StyleBox::get_margin returns border_width when content_margin < 0.
    const css = styleBoxToCss('StyleBoxFlat', {
      border_width_left: '2',
      border_width_top: '2',
      border_width_right: '2',
      border_width_bottom: '2',
    });
    expect(css.padding).toBe('2px 2px 2px 2px');
  });

  it('content_margin overrides border_width only on the sides it sets (#8)', () => {
    const css = styleBoxToCss('StyleBoxFlat', {
      border_width_left: '2',
      border_width_top: '2',
      border_width_right: '2',
      border_width_bottom: '2',
      content_margin_left: '10', // explicit left wins; others fall back to 2
    });
    expect(css.padding).toBe('2px 2px 2px 10px');
  });

  it('border_color defaults to light gray Color(0.8) not black (#42)', () => {
    const css = styleBoxToCss('StyleBoxFlat', { border_width_left: '1' });
    expect(css.borderColor).toBe('rgba(204, 204, 204, 1)');
  });

  it('shadow_size ≥ 1 emits a box-shadow with Godot defaults (#41)', () => {
    const css = styleBoxToCss('StyleBoxFlat', { bg_color: 'Color(1,1,1,1)', shadow_size: '4' });
    expect(css.boxShadow).toBe('0px 0px 4px rgba(0, 0, 0, 0.6)');
  });

  it('shadow honours explicit color and offset (#41)', () => {
    const css = styleBoxToCss('StyleBoxFlat', {
      shadow_size: '8',
      shadow_color: 'Color(1, 0, 0, 0.5)',
      shadow_offset: 'Vector2(3, -2)',
    });
    expect(css.boxShadow).toBe('3px -2px 8px rgba(255, 0, 0, 0.5)');
  });

  it('no box-shadow when shadow_size is absent or < 1 (#41)', () => {
    expect(styleBoxToCss('StyleBoxFlat', { bg_color: 'Color(1,1,1,1)' }).boxShadow).toBeUndefined();
    expect(styleBoxToCss('StyleBoxFlat', { shadow_size: '0' }).boxShadow).toBeUndefined();
  });
});

describe('colorToCss', () => {
  it('converts a Godot Color to rgba', () => {
    expect(colorToCss('Color(1, 0, 0, 1)')).toBe('rgba(255, 0, 0, 1)');
  });

  it('returns undefined for malformed input', () => {
    expect(colorToCss('not-a-color')).toBeUndefined();
  });

  it('clamps overbright (HDR) channels so CSS stays valid', () => {
    // Godot allows Color(2, 0, 0, 1); an unclamped rgba(510, …) is rejected by
    // browsers and silently drops the whole declaration.
    expect(colorToCss('Color(2, 0, 0, 1)')).toBe('rgba(255, 0, 0, 1)');
    expect(colorToCss('Color(-1, 0.5, 3, 2)')).toBe('rgba(0, 128, 255, 1)');
  });
});
