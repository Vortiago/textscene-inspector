import { describe, it, expect } from 'vitest';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  CONTROL_FONT_LOW_COLOR,
  CONTROL_FONT_LOWER_COLOR,
  CONTROL_FONT_PLACEHOLDER_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
  DEFAULT_CONTENT_MARGIN,
  DEFAULT_FONT_SIZE,
  STYLE_FILL,
  scaledGodotTheme,
} from './theme.js';

/** `fill_default_theme` (`scene/theme/default_theme.cpp:101-108`). */
describe('default theme font colours', () => {
  it('draws Control text in a light grey', () => {
    expect(CONTROL_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });

  it('halves the alpha of disabled text', () => {
    expect(CONTROL_FONT_DISABLED_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('draws placeholder text at 0.6 alpha', () => {
    expect(CONTROL_FONT_PLACEHOLDER_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.6 });
  });

  it('dims low text to 0.7 grey', () => {
    expect(CONTROL_FONT_LOW_COLOR).toEqual({ r: 0.7, g: 0.7, b: 0.7, a: 1 });
  });

  it('dims lower text to 0.65 grey', () => {
    expect(CONTROL_FONT_LOWER_COLOR).toEqual({ r: 0.65, g: 0.65, b: 0.65, a: 1 });
  });

  it('brightens hovered text to 0.95 grey', () => {
    expect(CONTROL_FONT_HOVER_COLOR).toEqual({ r: 0.95, g: 0.95, b: 0.95, a: 1 });
  });

  it('draws pressed text in white', () => {
    expect(CONTROL_FONT_PRESSED_COLOR).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});

describe('default theme metrics', () => {
  it('pins default_font_size = 16 (default_theme.cpp:50)', () => {
    expect(DEFAULT_FONT_SIZE).toBe(16);
  });

  it('pins default_margin = 4 (default_theme.cpp:54)', () => {
    expect(DEFAULT_CONTENT_MARGIN).toBe(4);
  });

  it('transcribes the StyleBoxFlat fills from their Color literals (default_theme.cpp:112-123)', () => {
    expect(STYLE_FILL).toEqual({
      normal: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 },
      hover: { r: 0.225, g: 0.225, b: 0.225, a: 0.6 },
      pressed: { r: 0, g: 0, b: 0, a: 0.6 },
      disabled: { r: 0.1, g: 0.1, b: 0.1, a: 0.3 },
      popup: { r: 0.25, g: 0.25, b: 0.25, a: 1 },
      progress: { r: 1, g: 1, b: 1, a: 0.4 },
    });
  });
});

/**
 * `gui/theme/default_theme_scale`. Godot rounds each product on its own:
 * `fill_default_theme` and `make_flat_stylebox` in `scene/theme/default_theme.cpp`,
 * and the BoxContainer separation at `default_theme.cpp:1249`.
 */
describe('scaledGodotTheme', () => {
  it('returns the unscaled Godot metrics at scale 1', () => {
    expect(scaledGodotTheme(1)).toEqual({
      scale: 1,
      fontSize: 16, // default_font_size, default_theme.cpp:50
      cornerRadius: 3, // default_corner_radius, default_theme.cpp:55
      contentMargin: 4, // default_margin, default_theme.cpp:54
      optionButtonMarginX: 8, // 2 * default_margin, default_theme.cpp:215
      optionButtonMarginY: 4, // default_margin, default_theme.cpp:215
      separation: 4, // Math::round(4 * scale), default_theme.cpp:1249
      sliderTrackThickness: 8, // two margins of make_flat_stylebox(…, 4, 4, 4, 4, 4), default_theme.cpp:579
      sliderCornerRadius: 4, // the corner radius of that call, default_theme.cpp:579
      sliderGrabberSize: 16, // the slider_grabber icon's 16x16 box
      sliderGrabberRadius: 7, // its circle's r="7"
      sliderTickBox: 4, // the 4x8 canvas of hslider_tick.svg
      sliderTickThickness: 2, // the 2px bar `pnpm ref:godot` measures
    });
  });

  it('scales every metric at the demo project’s 2.0', () => {
    // scenes/demos/viewport/gui_in_3d/project.godot sets 2.0.
    expect(scaledGodotTheme(2)).toEqual({
      scale: 2,
      fontSize: 32,
      cornerRadius: 6,
      contentMargin: 8,
      optionButtonMarginX: 16,
      optionButtonMarginY: 8,
      separation: 8,
      // The sliders grow with everything else: the styleboxes through
      // `make_flat_stylebox`, the grabber and tick because `generate_icon`
      // rasterises each SVG at the scale.
      sliderTrackThickness: 16,
      sliderCornerRadius: 8,
      sliderGrabberSize: 32,
      sliderGrabberRadius: 14,
      sliderTickBox: 8,
      sliderTickThickness: 4,
    });
  });

  it('rounds each metric independently, never the scale', () => {
    // A pre-rounded scale (1 or 2) could produce neither 24 nor 5.
    const theme = scaledGodotTheme(1.5);
    expect(theme.fontSize).toBe(24);
    expect(theme.cornerRadius).toBe(5);
    expect(theme.contentMargin).toBe(6);
    expect(theme.separation).toBe(6);
  });

  it('rounds a half up, as Godot’s Math::round does for a positive scale', () => {
    // round(3 · 1.25) = round(3.75) = 4; round(4 · 1.25) = 5.
    expect(scaledGodotTheme(1.25).cornerRadius).toBe(4);
    expect(scaledGodotTheme(1.25).contentMargin).toBe(5);
  });

  it('shrinks at a scale below 1', () => {
    // Godot's minimum is 0.5: round(16·0.5) = 8, round(3·0.5) = 2 (half up).
    expect(scaledGodotTheme(0.5)).toEqual({
      scale: 0.5,
      fontSize: 8,
      cornerRadius: 2,
      contentMargin: 2,
      optionButtonMarginX: 4,
      optionButtonMarginY: 2,
      separation: 2,
      sliderTrackThickness: 4,
      sliderCornerRadius: 2,
      sliderGrabberSize: 8,
      sliderGrabberRadius: 4,
      sliderTickBox: 2,
      sliderTickThickness: 1,
    });
  });
});
