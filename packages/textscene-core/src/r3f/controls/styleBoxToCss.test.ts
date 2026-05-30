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

  it('returns transparent ({}) for StyleBoxEmpty', () => {
    expect(styleBoxToCss('StyleBoxEmpty', {})).toEqual({});
  });
});

describe('colorToCss', () => {
  it('converts a Godot Color to rgba', () => {
    expect(colorToCss('Color(1, 0, 0, 1)')).toBe('rgba(255, 0, 0, 1)');
  });

  it('returns undefined for malformed input', () => {
    expect(colorToCss('not-a-color')).toBeUndefined();
  });
});
