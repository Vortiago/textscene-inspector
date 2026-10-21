import { describe, expect, it } from 'vitest';
import { decodeStyleBox } from './decode';

describe('decodeStyleBox', () => {
  it('reads a StyleBoxFlat, its unset content margins through the border widths', () => {
    const box = decodeStyleBox('StyleBoxFlat', {
      bg_color: 'Color(1, 0, 0, 1)',
      border_width_left: '3',
      corner_detail: '40',
    });

    expect(box).toMatchObject({
      bgColor: { r: 1, g: 0, b: 0, a: 1 },
      contentMargin: { left: 3, top: 0, right: 0, bottom: 0 },
      cornerDetail: 20, // CLAMP(detail, 1, 20), style_box_flat.cpp:130
    });
  });

  it('truncates a fractional border width and corner radius, as both slots are INT (edge case)', () => {
    // `set_border_width` and `set_corner_radius` take an int (style_box_flat.cpp:81,101).
    const box = decodeStyleBox('StyleBoxFlat', { border_width_top: '2.9', corner_radius_top_left: '6.5' });

    expect(box).toMatchObject({
      borderWidth: { left: 0, top: 2, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 6, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      contentMargin: { left: 0, top: 2, right: 0, bottom: 0 },
    });
  });

  it('truncates a fractional corner detail before the clamp, not rounding it (edge case)', () => {
    expect(decodeStyleBox('StyleBoxFlat', { corner_detail: '8.5' })?.cornerDetail).toBe(8);
  });

  it('wraps an int shadow size past int32 to the number the slot stores (edge case)', () => {
    expect(decodeStyleBox('StyleBoxFlat', { shadow_size: '4294967295' })?.shadowSize).toBe(-1);
  });

  it('returns null for a box type the slice does not claim (error path)', () => {
    expect(decodeStyleBox('StyleBoxLine', {})).toBeNull();
  });

  it('reads a StyleBoxEmpty as drawing nothing, its unset content margins as 0 (edge case)', () => {
    const box = decodeStyleBox('StyleBoxEmpty', { expand_margin_top: '2' });

    expect(box).toMatchObject({
      drawCenter: false,
      contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      expandMargin: { left: 0, top: 2, right: 0, bottom: 0 },
    });
  });
});
