/**
 * Pins each default-theme constant to its Godot 4.6 value in
 * `scene/theme/default_theme.cpp`, and each fill's CSS to an independent format
 * of its `Color(...)` literal.
 */
import { describe, expect, it } from 'vitest';
import type { ThemeFill } from './godotDefaultTheme';
import {
  DEFAULT_CONTENT_MARGIN,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_SEPARATION,
  OPTION_BUTTON_CONTENT_MARGIN_X,
  OPTION_BUTTON_CONTENT_MARGIN_Y,
  SLIDER_CORNER_RADIUS,
  SLIDER_GRABBER_RADIUS,
  SLIDER_GRABBER_SIZE,
  SLIDER_TICK_BOX,
  SLIDER_TICK_THICKNESS,
  SLIDER_TRACK_THICKNESS,
  STYLE_DISABLED_FILL,
  STYLE_HOVER_FILL,
  STYLE_NORMAL_FILL,
  STYLE_POPUP_FILL,
  STYLE_PRESSED_FILL,
  scaledGodotTheme,
} from './godotDefaultTheme';

/** An independent ground truth, not a copy of `godotDefaultTheme.ts`'s own `fillCss`. */
function controlColorToCss(c: ThemeFill): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const alpha = Math.max(0, Math.min(1, c.a));
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${alpha})`;
}

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

/**
 * `gui/theme/default_theme_scale`. Godot rounds each product on its own:
 * `fill_default_theme` and `make_flat_stylebox` in `scene/theme/default_theme.cpp`,
 * and the BoxContainer separation at `default_theme.cpp:1249`.
 */
describe('scaledGodotTheme', () => {
  it('returns exactly the scale-1 constants at scale 1', () => {
    // `.ts`-only consumers import the constants, so scale 1 must equal them.
    expect(scaledGodotTheme(1)).toEqual({
      scale: 1,
      fontSize: DEFAULT_FONT_SIZE,
      cornerRadius: DEFAULT_CORNER_RADIUS,
      contentMargin: DEFAULT_CONTENT_MARGIN,
      optionButtonMarginX: OPTION_BUTTON_CONTENT_MARGIN_X,
      optionButtonMarginY: OPTION_BUTTON_CONTENT_MARGIN_Y,
      separation: DEFAULT_SEPARATION,
      sliderTrackThickness: SLIDER_TRACK_THICKNESS,
      sliderCornerRadius: SLIDER_CORNER_RADIUS,
      sliderGrabberSize: SLIDER_GRABBER_SIZE,
      sliderGrabberRadius: SLIDER_GRABBER_RADIUS,
      sliderTickBox: SLIDER_TICK_BOX,
      sliderTickThickness: SLIDER_TICK_THICKNESS,
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
