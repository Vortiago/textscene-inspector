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
    const { styleFill: _styleFill, widgets: _widgets, ...scaledFields } = theme;
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

  const DEFAULT_BORDER_COLOR = { r: 0.8, g: 0.8, b: 0.8, a: 1 }; // style_box_flat.h:40, unset by make_flat_stylebox
  const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
  const uniform = (n: number) => ({ left: n, top: n, right: n, bottom: n });
  const uniformCorners = (n: number) => ({ topLeft: n, topRight: n, bottomRight: n, bottomLeft: n });

  describe('widgets', () => {
    it('Panel: make_flat_stylebox(style_normal_color, 0, 0, 0, 0) — default_theme.cpp:134', () => {
      const theme = nativeTheme(1);
      expect(theme.widgets.panel).toEqual({
        bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 },
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: ZERO_SIDES,
        cornerRadius: uniformCorners(3), // default_corner_radius, Math.round(3*1)
        expandMargin: ZERO_SIDES,
        contentMargin: ZERO_SIDES,
        drawCenter: true,
        borderBlend: false,
        antiAliased: true, // StyleBoxFlat's own untouched default (style_box_flat.h:49)
        aaSize: 1, // StyleBoxFlat's own untouched default (style_box_flat.h:54)
      });
    });

    it('Button normal/hover/pressed/disabled: make_flat_stylebox(color) with every default arg — default_theme.cpp:138-141', () => {
      const theme = nativeTheme(1);
      const shared = {
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: ZERO_SIDES,
        cornerRadius: uniformCorners(3), // default_corner_radius
        expandMargin: ZERO_SIDES,
        contentMargin: uniform(4), // default_margin
        drawCenter: true,
        borderBlend: false,
        antiAliased: true,
        aaSize: 1,
      };
      expect(theme.widgets.button.normal).toEqual({ ...shared, bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 } });
      expect(theme.widgets.button.hover).toEqual({ ...shared, bgColor: { r: 0.225, g: 0.225, b: 0.225, a: 0.6 } });
      expect(theme.widgets.button.pressed).toEqual({ ...shared, bgColor: { r: 0, g: 0, b: 0, a: 0.6 } });
      expect(theme.widgets.button.disabled).toEqual({ ...shared, bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.3 } });
    });

    it('ScrollBar scroll: make_flat_stylebox(style_normal_color, ..., 10) per axis — default_theme.cpp:543-544', () => {
      const theme = nativeTheme(1);
      // style_h_scrollbar = make_flat_stylebox(style_normal_color, 0, 4, 0, 4, 10):
      // 0 margin along the track axis (left/right), 4 across it (top/bottom).
      expect(theme.widgets.scrollBar.scrollHorizontal).toEqual({
        bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 },
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: ZERO_SIDES,
        cornerRadius: uniformCorners(10),
        expandMargin: ZERO_SIDES,
        contentMargin: { left: 0, top: 4, right: 0, bottom: 4 },
        drawCenter: true,
        borderBlend: false,
        antiAliased: true,
        aaSize: 1,
      });
      // style_v_scrollbar = make_flat_stylebox(style_normal_color, 4, 0, 4, 0, 10): transposed.
      expect(theme.widgets.scrollBar.scrollVertical).toEqual({
        bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 },
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: ZERO_SIDES,
        cornerRadius: uniformCorners(10),
        expandMargin: ZERO_SIDES,
        contentMargin: { left: 4, top: 0, right: 4, bottom: 0 },
        drawCenter: true,
        borderBlend: false,
        antiAliased: true,
        aaSize: 1,
      });
    });

    it('ScrollBar grabber: make_flat_stylebox(style_progress_color, 4, 4, 4, 4, 10) — default_theme.cpp:545', () => {
      const theme = nativeTheme(1);
      expect(theme.widgets.scrollBar.grabber).toEqual({
        bgColor: { r: 1, g: 1, b: 1, a: 0.4 },
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: ZERO_SIDES,
        cornerRadius: uniformCorners(10),
        expandMargin: ZERO_SIDES,
        contentMargin: uniform(4),
        drawCenter: true,
        borderBlend: false,
        antiAliased: true,
        aaSize: 1,
      });
    });

    it('scales widget geometry (margins, corner radii) at scale 2, per make_flat_stylebox\'s Math.round(x * scale)', () => {
      const theme = nativeTheme(2);
      expect(theme.widgets.panel.cornerRadius).toEqual(uniformCorners(6));
      expect(theme.widgets.button.normal.contentMargin).toEqual(uniform(8));
      expect(theme.widgets.button.normal.cornerRadius).toEqual(uniformCorners(6));
      expect(theme.widgets.scrollBar.scrollHorizontal.cornerRadius).toEqual(uniformCorners(20));
      expect(theme.widgets.scrollBar.scrollHorizontal.contentMargin).toEqual({ left: 0, top: 8, right: 0, bottom: 8 });
      expect(theme.widgets.scrollBar.grabber.cornerRadius).toEqual(uniformCorners(20));
    });

    it('does NOT scale widget fill colours', () => {
      const theme = nativeTheme(2);
      expect(theme.widgets.button.normal.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
      expect(theme.widgets.scrollBar.grabber.bgColor).toEqual({ r: 1, g: 1, b: 1, a: 0.4 });
    });

    it('SplitContainer: separation 12, grabber extent 8, autohide true — default_theme.cpp:1258-1266', () => {
      const theme = nativeTheme(1);
      expect(theme.widgets.splitContainer).toEqual({ separation: 12, grabberExtent: 8, autohide: true });
    });

    it('scales SplitContainer separation and grabber extent at scale 2, but never autohide', () => {
      const theme = nativeTheme(2);
      expect(theme.widgets.splitContainer).toEqual({ separation: 24, grabberExtent: 16, autohide: true });
    });

    it(
      'LineEdit normal: make_flat_stylebox(style_normal_color) + a 2px UNSCALED bottom border in ' +
        'style_pressed_color — default_theme.cpp:405-409',
      () => {
        const theme = nativeTheme(1);
        expect(theme.widgets.lineEdit.normal).toEqual({
          bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 }, // style_normal_color
          borderColor: { r: 0, g: 0, b: 0, a: 0.6 }, // style_pressed_color
          borderWidth: { left: 0, top: 0, right: 0, bottom: 2 },
          cornerRadius: uniformCorners(3), // default_corner_radius
          expandMargin: ZERO_SIDES,
          contentMargin: uniform(4), // default_margin
          drawCenter: true,
          borderBlend: false,
          antiAliased: true,
          aaSize: 1,
        });
      }
    );

    it(
      'LineEdit read_only: make_flat_stylebox(style_disabled_color) + the SAME 2px bottom border, ' +
        'HALF style_pressed_color\'s alpha — default_theme.cpp:413-417',
      () => {
        const theme = nativeTheme(1);
        expect(theme.widgets.lineEdit.readOnly).toEqual({
          bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.3 }, // style_disabled_color
          borderColor: { r: 0, g: 0, b: 0, a: 0.3 }, // style_pressed_color * Color(1,1,1,0.5)
          borderWidth: { left: 0, top: 0, right: 0, bottom: 2 },
          cornerRadius: uniformCorners(3),
          expandMargin: ZERO_SIDES,
          contentMargin: uniform(4),
          drawCenter: true,
          borderBlend: false,
          antiAliased: true,
          aaSize: 1,
        });
      }
    );

    it('scales LineEdit\'s margin/radius at scale 2, but the 2px bottom border stays UNSCALED', () => {
      const theme = nativeTheme(2);
      expect(theme.widgets.lineEdit.normal.contentMargin).toEqual(uniform(8));
      expect(theme.widgets.lineEdit.normal.cornerRadius).toEqual(uniformCorners(6));
      expect(theme.widgets.lineEdit.normal.borderWidth).toEqual({ left: 0, top: 0, right: 0, bottom: 2 });
      expect(theme.widgets.lineEdit.readOnly.borderWidth).toEqual({ left: 0, top: 0, right: 0, bottom: 2 });
    });
  });
});
