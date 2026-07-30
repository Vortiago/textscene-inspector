/**
 * `NativeTheme` — pins its added numeric StyleBoxFlat fill colours to the
 * exact `scene/theme/default_theme.cpp` `Color(...)` literals, and proves it
 * genuinely extends `ScaledGodotTheme` (every scalable metric passes through
 * `scaledGodotTheme` unchanged, while colours are NOT scaled).
 */
import { describe, expect, it } from 'vitest';
import { scaledGodotTheme } from '../godotDefaultTheme';
import { nativeTheme } from './nativeTheme';

describe('nativeTheme', () => {
  it('pins style fill colours to their default_theme.cpp Color(...) literals', () => {
    // scene/theme/default_theme.cpp, fill_default_theme:
    const theme = nativeTheme(1);
    expect(theme.styleFill.normal).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 }); // style_normal_color
    expect(theme.styleFill.hover).toEqual({ r: 0.225, g: 0.225, b: 0.225, a: 0.6 }); // style_hover_color
    expect(theme.styleFill.pressed).toEqual({ r: 0, g: 0, b: 0, a: 0.6 }); // style_pressed_color
    expect(theme.styleFill.disabled).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.3 }); // style_disabled_color
    expect(theme.styleFill.popup).toEqual({ r: 0.25, g: 0.25, b: 0.25, a: 1 }); // style_popup_color
    expect(theme.styleFill.progress).toEqual({ r: 1, g: 1, b: 1, a: 0.4 }); // style_progress_color
  });

  it('carries every ScaledGodotTheme field verbatim at scale 1', () => {
    const theme = nativeTheme(1);
    const { styleFill: _styleFill, ...scaledFields } = theme;
    expect(scaledFields).toEqual(scaledGodotTheme(1));
  });

  it('doubles every scalable metric at scale 2, per scaledGodotTheme', () => {
    // scene/theme/default_theme.cpp fill_default_theme / make_flat_stylebox:
    // Math::round(default_font_size * 2) = 32, Math::round(default_corner_radius * 2) = 6, etc.
    const theme = nativeTheme(2);
    expect(theme.fontSize).toBe(32);
    expect(theme.cornerRadius).toBe(6);
    expect(theme.contentMargin).toBe(8);
    expect(theme.separation).toBe(8);
    expect(theme.sliderTrackThickness).toBe(16);
    expect(theme.sliderGrabberSize).toBe(32);
  });

  it('does NOT scale style fill colours — default_theme_scale only touches geometry', () => {
    // fill_default_theme scales every length it passes to make_flat_stylebox,
    // never a Color literal, so style_normal_color stays Color(0.1, 0.1, 0.1, 0.6)
    // at any scale.
    const theme = nativeTheme(2);
    expect(theme.styleFill.normal).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
  });
});
