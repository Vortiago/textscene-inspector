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
