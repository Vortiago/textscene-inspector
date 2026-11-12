/**
 * Pins `NativeTheme`'s StyleBoxFlat fill colours to the `scene/theme/default_theme.cpp`
 * `Color(...)` literals, and checks that every scalable metric passes through
 * `scaledGodotTheme` unchanged while colours are not scaled.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_VARIATIONS, scaledGodotTheme } from '../../../godot/scene/theme';
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
    // Math::round(default_font_size * 2) = 32, Math::round(default_corner_radius * 2) = 6, and so on.
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
    it('Button focus: an uncentred 2 px ring flush outside the button, scaled with the theme (default_theme.cpp:142-144)', () => {
      const { focus } = nativeTheme(1).widgets.button;
      expect([focus.drawCenter, focus.borderWidth.left, focus.expandMargin.left]).toEqual([false, 2, 2]);
      expect(nativeTheme(1.5).widgets.button.focus.borderWidth.left).toBe(3);
    });

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
        aaSize: 1,
        cornerDetail: 5,
        skew: { x: 0, y: 0 },
        shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
        shadowSize: 0,
        shadowOffset: { x: 0, y: 0 }, // StyleBoxFlat's own untouched default (style_box_flat.h:54)
      });
    });

    it('PopupPanel: make_flat_stylebox(style_normal_color) with the default margin — default_theme.cpp:726', () => {
      const { popupPanel } = nativeTheme(1).widgets;
      expect(popupPanel.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
      expect(popupPanel.contentMargin).toEqual({ left: 4, top: 4, right: 4, bottom: 4 });
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
        cornerDetail: 5,
        skew: { x: 0, y: 0 },
        shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
        shadowSize: 0,
        shadowOffset: { x: 0, y: 0 },
      };
      expect(theme.widgets.button.normal).toEqual({ ...shared, bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 } });
      expect(theme.widgets.button.hover).toEqual({
        ...shared,
        bgColor: { r: 0.225, g: 0.225, b: 0.225, a: 0.6 },
      });
      expect(theme.widgets.button.pressed).toEqual({ ...shared, bgColor: { r: 0, g: 0, b: 0, a: 0.6 } });
      expect(theme.widgets.button.disabled).toEqual({
        ...shared,
        bgColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.3 },
      });
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
        cornerDetail: 6,
        skew: { x: 0, y: 0 },
        shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
        shadowSize: 0,
        shadowOffset: { x: 0, y: 0 },
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
        cornerDetail: 6,
        skew: { x: 0, y: 0 },
        shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
        shadowSize: 0,
        shadowOffset: { x: 0, y: 0 },
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
        cornerDetail: 6,
        skew: { x: 0, y: 0 },
        shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
        shadowSize: 0,
        shadowOffset: { x: 0, y: 0 },
      });
    });

    it("scales widget geometry (margins, corner radii) at scale 2, per make_flat_stylebox's Math.round(x * scale)", () => {
      const theme = nativeTheme(2);
      expect(theme.widgets.panel.cornerRadius).toEqual(uniformCorners(6));
      expect(theme.widgets.button.normal.contentMargin).toEqual(uniform(8));
      expect(theme.widgets.button.normal.cornerRadius).toEqual(uniformCorners(6));
      expect(theme.widgets.scrollBar.scrollHorizontal.cornerRadius).toEqual(uniformCorners(20));
      expect(theme.widgets.scrollBar.scrollHorizontal.contentMargin).toEqual({
        left: 0,
        top: 8,
        right: 0,
        bottom: 8,
      });
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
          cornerDetail: 5,
          skew: { x: 0, y: 0 },
          shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
          shadowSize: 0,
          shadowOffset: { x: 0, y: 0 },
        });
      }
    );

    it(
      'LineEdit read_only: make_flat_stylebox(style_disabled_color) + the SAME 2px bottom border, ' +
        "HALF style_pressed_color's alpha — default_theme.cpp:413-417",
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
          cornerDetail: 5,
          skew: { x: 0, y: 0 },
          shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
          shadowSize: 0,
          shadowOffset: { x: 0, y: 0 },
        });
      }
    );

    it("scales LineEdit's margin/radius at scale 2, but the 2px bottom border stays UNSCALED", () => {
      const theme = nativeTheme(2);
      expect(theme.widgets.lineEdit.normal.contentMargin).toEqual(uniform(8));
      expect(theme.widgets.lineEdit.normal.cornerRadius).toEqual(uniformCorners(6));
      expect(theme.widgets.lineEdit.normal.borderWidth).toEqual({ left: 0, top: 0, right: 0, bottom: 2 });
      expect(theme.widgets.lineEdit.readOnly.borderWidth).toEqual({ left: 0, top: 0, right: 0, bottom: 2 });
    });
  });

  describe('dialogPanel', () => {
    it('scales the margin twice, as the call passes a scaled margin to make_flat_stylebox', () => {
      expect(nativeTheme(1).widgets.dialogPanel.contentMargin).toEqual(uniform(8));
      expect(nativeTheme(1.5).widgets.dialogPanel.contentMargin).toEqual(uniform(18));
    });
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

    it('rebuilds for NaN, which never equals itself', () => {
      expect(nativeTheme(Number.NaN)).not.toBe(nativeTheme(Number.NaN));
    });
  });

  describe('corner detail', () => {
    it('truncates the scaled detail to an int, as set_corner_detail does', () => {
      expect(nativeTheme(1).widgets.popupMenuPanel.cornerDetail).toBe(5);
      expect(nativeTheme(1.5).widgets.popupMenuPanel.cornerDetail).toBe(7);
    });

    // The detail follows the Godot radius before the scale: 3 for most boxes, 4 for the slider,
    // 10 for the scroll bar, 0 for the dialog panel and the flat menu button (clamped to 1).
    it.each([
      [1, 5, 6, 6, 1],
      [2, 10, 12, 12, 1],
    ])(
      'gives each widget the detail of its radius at scale %i',
      (scale, defaultRadius, slider, scrollBar, none) => {
        const { widgets } = nativeTheme(scale);
        expect({
          panel: widgets.panel.cornerDetail,
          popupPanel: widgets.popupPanel.cornerDetail,
          tooltipPanel: widgets.tooltipPanel.cornerDetail,
          popupMenuPanel: widgets.popupMenuPanel.cornerDetail,
          buttonNormal: widgets.button.normal.cornerDetail,
          buttonFocus: widgets.button.focus.cornerDetail,
          optionButton: widgets.optionButton.pressed.cornerDetail,
          lineEdit: widgets.lineEdit.normal.cornerDetail,
          sliderTrack: widgets.slider.track.cornerDetail,
          sliderFill: widgets.slider.fill.cornerDetail,
          scrollHorizontal: widgets.scrollBar.scrollHorizontal.cornerDetail,
          scrollGrabber: widgets.scrollBar.grabber.cornerDetail,
          dialogPanel: widgets.dialogPanel.cornerDetail,
          flatMenuButton: widgets.flatMenuButton.normal.cornerDetail,
          tabSelected: widgets.tabContainer.selected.cornerDetail,
          tabHovered: widgets.tabContainer.hovered.cornerDetail,
        }).toEqual({
          panel: defaultRadius,
          popupPanel: defaultRadius,
          tooltipPanel: defaultRadius,
          popupMenuPanel: defaultRadius,
          buttonNormal: defaultRadius,
          buttonFocus: defaultRadius,
          optionButton: defaultRadius,
          lineEdit: defaultRadius,
          sliderTrack: slider,
          sliderFill: slider,
          scrollHorizontal: scrollBar,
          scrollGrabber: scrollBar,
          dialogPanel: none,
          flatMenuButton: none,
          tabSelected: none,
          tabHovered: none,
        });
      }
    );
  });

  describe('the default type variations it models', () => {
    it('registers FlatMenuButton with a base type, as widgets.flatMenuButton holds its boxes', () => {
      expect(DEFAULT_THEME_VARIATIONS.FlatMenuButton).toBeTruthy();
      expect(nativeTheme(1).widgets.flatMenuButton).toBeDefined();
    });

    it('gives the FlatMenuButton boxes the margins of the Button box and no fill (default_theme.cpp:360-375)', () => {
      const { widgets } = nativeTheme(1);
      expect(widgets.flatMenuButton.normal.contentMargin).toEqual(widgets.button.normal.contentMargin);
      expect(widgets.flatMenuButton.normal.bgColor.a).toBe(0);
    });

    it('freezes the shared tab, FlatMenuButton and Button boxes, so an in-place margin edit throws', () => {
      const { widgets } = nativeTheme(1);
      for (const box of [
        widgets.tabContainer.unselected,
        widgets.flatMenuButton.normal,
        widgets.button.normal,
      ]) {
        const margin = box.contentMargin as { left: number };
        expect(() => {
          margin.left += 1;
        }).toThrow(TypeError);
      }
    });
  });
});
