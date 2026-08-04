/**
 * `resolveTextTheme` — the override key-name mapping a Control authors as
 * `theme_override_font_sizes/<key>` / `theme_override_colors/<key>`, resolved
 * to plain data a painter can read.
 */
import { describe, expect, it } from 'vitest';
import { resolveTextTheme, type TextThemeKeys } from './textTheme';

const LABEL_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };
const RICH_TEXT_LABEL_KEYS: TextThemeKeys = { sizeKey: 'normal_font_size', colorKey: 'default_color' };
const DEFAULTS = { fontSizePx: 16, color: { r: 1, g: 1, b: 1, a: 1 } };

describe('resolveTextTheme', () => {
  it('falls back to the supplied defaults when no override is present', () => {
    const resolved = resolveTextTheme({}, LABEL_KEYS, DEFAULTS);
    expect(resolved).toEqual({ fontSizePx: 16, color: { r: 1, g: 1, b: 1, a: 1 } });
  });

  it('reads font_size/font_color for Label-shaped keys', () => {
    const resolved = resolveTextTheme(
      {
        themeOverrideFontSizes: { font_size: 24 },
        themeOverrideColors: { font_color: { r: 0.2, g: 0.4, b: 0.6, a: 0.8 } },
      },
      LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved).toEqual({ fontSizePx: 24, color: { r: 0.2, g: 0.4, b: 0.6, a: 0.8 } });
  });

  it('reads normal_font_size/default_color for RichTextLabel-shaped keys, ignoring Label-shaped ones', () => {
    const resolved = resolveTextTheme(
      {
        themeOverrideFontSizes: { normal_font_size: 20, font_size: 99 },
        themeOverrideColors: { default_color: { r: 0, g: 0, b: 0, a: 1 } },
      },
      RICH_TEXT_LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved).toEqual({ fontSizePx: 20, color: { r: 0, g: 0, b: 0, a: 1 } });
  });

  it('resolves size and colour independently — one overridden, the other defaulted', () => {
    const resolved = resolveTextTheme(
      { themeOverrideFontSizes: { font_size: 30 } },
      LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved).toEqual({ fontSizePx: 30, color: { r: 1, g: 1, b: 1, a: 1 } });
  });
});
