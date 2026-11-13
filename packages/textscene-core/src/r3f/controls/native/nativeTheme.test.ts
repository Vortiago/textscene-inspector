/** `nativeTheme`: every scaled metric of `scaledGodotTheme`, built once per scale. */
import { describe, expect, it } from 'vitest';
import { scaledGodotTheme } from '../../../godot/scene/theme';
import { nativeTheme } from './nativeTheme';

describe('nativeTheme', () => {
  it('carries every ScaledGodotTheme field at scale 1', () => {
    expect(nativeTheme(1)).toEqual(scaledGodotTheme(1));
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
