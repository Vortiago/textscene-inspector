/**
 * Pins `NativeTheme`'s StyleBoxFlat fill colours to the `scene/theme/default_theme.cpp`
 * `Color(...)` literals, and checks that every scalable metric passes through
 * `scaledGodotTheme` unchanged while colours are not scaled.
 */
import { describe, expect, it } from 'vitest';
import { scaledGodotTheme } from '../../../godot/scene/theme';
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
    // Math::round(default_font_size * 2) = 32, Math::round(default_corner_radius * 2) = 6, and so on.
    const theme = nativeTheme(2);
    expect(theme.fontSize).toBe(32);
    expect(theme.cornerRadius).toBe(6);
    expect(theme.contentMargin).toBe(8);
    expect(theme.separation).toBe(8);
    expect(theme.sliderGrabberSize).toBe(32);
  });

  it('does not scale style fill colours: default_theme_scale only touches geometry', () => {
    // fill_default_theme scales every length it passes to make_flat_stylebox,
    // never a Color literal, so style_normal_color stays Color(0.1, 0.1, 0.1, 0.6)
    // at any scale.
    const theme = nativeTheme(2);
    expect(theme.styleFill.normal).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
  });

  describe('cache', () => {
    it('returns the same theme for the same scale', () => {
      expect(nativeTheme(1)).toBe(nativeTheme(1));
    });

    it('builds a new theme when the scale changes', () => {
      const first = nativeTheme(1);
      expect(nativeTheme(2)).not.toBe(first);
      expect(nativeTheme(2).scale).toBe(2);
    });

    it('keeps the theme of a scale while another scale is asked for', () => {
      const first = nativeTheme(1);
      nativeTheme(2);
      expect(nativeTheme(1)).toBe(first);
    });
  });
});
