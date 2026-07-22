/**
 * The Godot default-theme constants are transcribed from
 * `scene/theme/default_theme.cpp` — this pins each to the exact Godot 4.6 value
 * and, for the fills, ties the CSS string to `controlColorToCss` of the source
 * `Color(...)` literal so a wrong rounding/format can't slip through.
 */
import { describe, expect, it } from 'vitest';
import { controlColorToCss } from './styleBoxToCss';
import {
  DEFAULT_CONTENT_MARGIN,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_SEPARATION,
  OPTION_BUTTON_CONTENT_MARGIN_X,
  OPTION_BUTTON_CONTENT_MARGIN_Y,
  STYLE_DISABLED_FILL,
  STYLE_HOVER_FILL,
  STYLE_NORMAL_FILL,
  STYLE_POPUP_FILL,
  STYLE_PRESSED_FILL,
} from './godotDefaultTheme';

describe('godotDefaultTheme', () => {
  it('derives DEFAULT_FONT_COLOR from control_font_color = Color(0.875, 0.875, 0.875)', () => {
    // round(0.875 * 255) = 223 = 0xDF → #dfdfdf.
    expect(Math.round(0.875 * 255)).toBe(223);
    expect(DEFAULT_FONT_COLOR).toBe('rgb(223, 223, 223)');
  });

  it('pins default_font_size = 16', () => {
    expect(DEFAULT_FONT_SIZE).toBe(16);
  });

  it('renders the StyleBoxFlat fills from their Godot Color literals', () => {
    expect(STYLE_NORMAL_FILL).toBe(controlColorToCss({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 }));
    expect(STYLE_HOVER_FILL).toBe(controlColorToCss({ r: 0.225, g: 0.225, b: 0.225, a: 0.6 }));
    expect(STYLE_PRESSED_FILL).toBe(controlColorToCss({ r: 0, g: 0, b: 0, a: 0.6 }));
    expect(STYLE_DISABLED_FILL).toBe(controlColorToCss({ r: 0.1, g: 0.1, b: 0.1, a: 0.3 }));
    expect(STYLE_POPUP_FILL).toBe(controlColorToCss({ r: 0.25, g: 0.25, b: 0.25, a: 1 }));
  });

  it('spells out the normal fill as translucent near-black (not pre-composited)', () => {
    // Kept at alpha 0.6 so it blends over the overlay backdrop like Godot does.
    expect(STYLE_NORMAL_FILL).toBe('rgba(26, 26, 26, 0.6)');
  });

  it('pins the flat-stylebox geometry: corner radius 3, margins 4, OptionButton 8/4', () => {
    expect(DEFAULT_CORNER_RADIUS).toBe(3);
    expect(DEFAULT_CONTENT_MARGIN).toBe(4);
    expect(OPTION_BUTTON_CONTENT_MARGIN_X).toBe(8);
    expect(OPTION_BUTTON_CONTENT_MARGIN_Y).toBe(4);
  });

  it('pins the default container separation = 4', () => {
    expect(DEFAULT_SEPARATION).toBe(4);
  });
});
