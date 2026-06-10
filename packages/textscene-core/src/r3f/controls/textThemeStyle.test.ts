/**
 * textThemeStyle maps a Control's theme font-size/color overrides to CSS.
 * The theme key names vary per control (Label/Button use font_size/font_color,
 * RichTextLabel uses normal_font_size/default_color), so the keys are passed in.
 */
import { describe, it, expect } from 'vitest';
import { textThemeStyle } from './textThemeStyle';
import { controlColorToCss } from './styleBoxToCss';
import type { ControlColor } from '../../nodes/2d/ui/control/types';

const RED: ControlColor = { r: 1, g: 0, b: 0, a: 1 };
const LABEL_KEYS = { sizeKey: 'font_size', colorKey: 'font_color' };

describe('textThemeStyle', () => {
  it('maps a font-size override to a px fontSize', () => {
    const style = textThemeStyle(
      { themeOverrideFontSizes: { font_size: 24 } },
      LABEL_KEYS
    );
    expect(style.fontSize).toBe('24px');
  });

  it('maps a font-color override through controlColorToCss', () => {
    const style = textThemeStyle({ themeOverrideColors: { font_color: RED } }, LABEL_KEYS);
    expect(style.color).toBe(controlColorToCss(RED));
  });

  it('returns an empty style when no overrides are present', () => {
    expect(textThemeStyle({}, LABEL_KEYS)).toEqual({});
  });

  it('honors per-control key names (RichTextLabel: normal_font_size/default_color)', () => {
    const style = textThemeStyle(
      { themeOverrideFontSizes: { normal_font_size: 18 }, themeOverrideColors: { default_color: RED } },
      { sizeKey: 'normal_font_size', colorKey: 'default_color' }
    );
    expect(style.fontSize).toBe('18px');
    expect(style.color).toBe(controlColorToCss(RED));
  });

  it('ignores a font size of 0 (falsy → no override)', () => {
    const style = textThemeStyle({ themeOverrideFontSizes: { font_size: 0 } }, LABEL_KEYS);
    expect(style.fontSize).toBeUndefined();
  });
});
