import { describe, expect, it } from 'vitest';
import { parseControl } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseControl', () => {
  it('parses anchors_preset and layout_mode', () => {
    const p = parseControl(heading({ name: 'Bg', type: 'Control' }), {
      anchors_preset: '15',
      layout_mode: '1',
    });
    expect(p.anchorsPreset).toBe(15);
    expect(p.layoutMode).toBe(1);
  });

  it('parses explicit anchors and offsets', () => {
    const p = parseControl(heading({ name: 'P', type: 'Control' }), {
      anchor_left: '1.0',
      offset_left: '-220',
      offset_top: '10',
    });
    expect(p.anchorLeft).toBe(1);
    expect(p.offsetLeft).toBe(-220);
    expect(p.offsetTop).toBe(10);
  });

  it('collects theme overrides into typed maps', () => {
    const p = parseControl(heading({ name: 'L', type: 'Control' }), {
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
    const p = parseControl(heading({ name: 'B', type: 'Control' }), {
      custom_minimum_size: 'Vector2(120, 40)',
      size_flags_horizontal: '3',
    });
    expect(p.customMinimumSize).toEqual({ x: 120, y: 40 });
    expect(p.sizeFlagsHorizontal).toBe(3);
  });

  it('captures visibility', () => {
    expect(parseControl(heading({ name: 'C', type: 'Control' }), { visible: 'false' }).visible).toBe(false);
  });
});
