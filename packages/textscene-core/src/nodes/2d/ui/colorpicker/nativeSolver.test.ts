import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import {
  hsvToRgb,
  invertRgb,
  extractHsv,
  colorPickerScale,
  colorPickerRows,
  colorPickerMinimumSize,
  svAndHueRects,
  svSquareCursorPosition,
  hueIndicatorY,
  sampleRowColumns,
  hexRowColumns,
  modeRowButtonRects,
  swatchesRowRects,
  sliderGridRowRects,
  colorPickerValueColumnWidth,
  colorPickerHexFieldMinWidth,
  colorPickerMenuButtonSize,
  colorPickerLabelColumnWidth,
  colorPickerModeButtonStyleBox,
  colorPickerSliderBoxRect,
  colorPickerChannelGrabberRect,
  colorPickerIntensityRatio,
} from './nativeSolver';

const THEME = nativeTheme(1);
const CTX: SolveContext = { theme: THEME, measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'P', type: 'ColorPicker', children: [], properties };
  return { ...emptySolveNode(), path: 'P', node: tscnNode };
}

/** `colorPickerMinimumSize` only ever returns a bare `Vec2` (no `meta`) — narrows the `MinimumSizeFn` union for the tests below. */
function minHeight(result: ReturnType<typeof colorPickerMinimumSize>): number {
  return 'y' in result ? result.y : result.size.y;
}

describe('hsvToRgb', () => {
  // core/math/color.cpp:182-227 (Color::set_hsv), case i:0 h in [0,1/6).
  it('is pure red at h=0, s=1, v=1', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('is achromatic grey at s=0, independent of h', () => {
    expect(hsvToRgb(0.42, 0, 0.5)).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
  });

  it('wraps h past 1 the same as Math::fmod on a negative-safe range', () => {
    expect(hsvToRgb(1, 1, 1)).toEqual(hsvToRgb(0, 1, 1));
  });
});

describe('invertRgb', () => {
  it('flips rgb and leaves alpha — core/math/color.h Color::inverted()', () => {
    expect(invertRgb({ r: 0.2, g: 0.4, b: 0.6, a: 0.5 })).toEqual({ r: 0.8, g: 0.6, b: 0.4, a: 0.5 });
  });
});

describe('extractHsv', () => {
  it('matches Color::get_h/get_s/get_v directly for a non-overbright colour', () => {
    // color_picker.cpp:593-602: multiplier is 1 for any channel <= 1, so
    // color_normalized === color and this is the plain HSV extraction.
    const { h, s, v } = extractHsv({ r: 1, g: 0, b: 0, a: 1 });
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('normalises an overbright colour before extracting h/s/v — color_picker.cpp:593-602', () => {
    // r=2 (linear-equivalent overbright red): multiplier > 1, so v settles
    // back to 1 after the srgb round-trip, not 2.
    const { s, v } = extractHsv({ r: 2, g: 0, b: 0, a: 1 });
    expect(s).toBeCloseTo(1, 2);
    expect(v).toBeCloseTo(1, 2);
  });

  it('is achromatic (h=0) for pure black', () => {
    expect(extractHsv({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe('colorPickerScale', () => {
  it('is 1 at the default theme', () => {
    expect(colorPickerScale(THEME)).toBe(1);
  });

  it('reads the theme\'s own raw scale', () => {
    expect(colorPickerScale({ scale: 2 })).toBe(2);
  });
});

const ALL_ROWS_HIDDEN = {
  samplerVisible: false,
  colorModesVisible: false,
  slidersVisible: false,
  hexVisible: false,
  presetsVisible: false,
};

// A deterministic stand-in for `ctx.measureText`/`TextWidthMeasurer` — 10px
// per character, 20px tall, so every expected number below is hand-checkable.
const measure = (text: string) => ({ x: text.length * 10, y: 20 });
const measureText: SolveContext['measureText'] = (text) => measure(text);

describe('colorPickerRows', () => {
  it('sizes the shape row from sv_width/sv_height/h_width at scale 1 — default_theme.cpp:1077-1079, no other row present', () => {
    const rows = colorPickerRows(400, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 0 }, null);
    expect(rows.shape).toEqual({ x: 0, y: 0, w: 400, h: 256 });
    expect(rows.sample).toBeNull();
    expect(rows.totalHeight).toBe(256);
  });

  it('floors the shape row at its own minimum when the solved width is narrower', () => {
    const rows = colorPickerRows(50, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 0 }, null);
    expect(rows.shape!.w).toBe(290); // 256 + 4 + 30
  });

  it('draws no shape row for any picker_shape but SHAPE_HSV_RECTANGLE, keeping the row a (zero-height) stacking slot', () => {
    const wheel = colorPickerRows(400, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 1, samplerVisible: true }, null);
    expect(wheel.shape).toBeNull();
    expect(wheel.sample).toEqual({ x: 0, y: 4, w: 400, h: 24 });
  });

  it('draws no shape row for SHAPE_NONE (4) — matches Godot exactly, not a gap', () => {
    expect(colorPickerRows(400, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 4 }, null).shape).toBeNull();
  });

  it('drops every hidden row AND its separation gap — color_picker.cpp:1906-1956', () => {
    const rows = colorPickerRows(400, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 0 }, measure);
    expect(rows.mode).toBeNull();
    expect(rows.sliders).toBeNull();
    expect(rows.hex).toBeNull();
    expect(rows.swatches).toBeNull();
    expect(rows.sample).toBeNull();
    // Only the shape row (always a stacking slot) contributes.
    expect(rows.totalHeight).toBe(256);
  });

  it('sizes every row when all are visible, with a deterministic 10px/char measurer', () => {
    const rows = colorPickerRows(400, THEME, { pickerShape: 0 }, measure);
    // mode: 3 buttons ("RGB"=30,"HSV"=30,"Linear"=60) + dropdown(28) + 3*sep(4) = 160.
    // height: max(tab stylebox margin(8), btn_mode nat(16+8=24), text(20)+tab margin(8)=28) = 28.
    expect(rows.mode).toEqual({ x: 0, y: 288, w: 400, h: 28 });
    // sliders: 5 rows (3 channels + alpha + intensity, both default true) * (20+8) + 4*sep(4) = 140+16=156.
    expect(rows.sliders).toEqual({ x: 0, y: 320, w: 400, h: 156 });
    expect(rows.sliderRowCount).toBe(5);
    // hex: 20 + 8 (LineEdit content margin) = 28.
    expect(rows.hex).toEqual({ x: 0, y: 480, w: 400, h: 28 });
    // swatches: row1 max("Swatches"=20, menu_btn nat(16+8)=24)=24, + sep(4) + "Recent Colors"=20 = 48 tall.
    expect(rows.swatches).toEqual({ x: 0, y: 512, w: 400, h: 48 });
    expect(rows.totalHeight).toBe(560);
  });

  it('edit_alpha=false drops one slider row and its own trailing space', () => {
    const rows = colorPickerRows(400, THEME, { pickerShape: 0, editAlpha: false }, measure);
    expect(rows.sliderRowCount).toBe(4);
    expect(rows.sliders!.h).toBe(4 * 28 + 3 * 4); // 124
  });

  it('edit_intensity=false drops one slider row', () => {
    const rows = colorPickerRows(400, THEME, { pickerShape: 0, editIntensity: false }, measure);
    expect(rows.sliderRowCount).toBe(4);
  });

  it('swatches row 1 floors to menu_btn\'s own 16px icon height even with no text measurer', () => {
    // `palette_box`'s row height is max(btn_preset text, menu_btn icon) — the
    // icon still sits in that row when `measure` cannot size the text beside
    // it; `btn_recent_preset`'s own row still follows, separation and all.
    const rows = colorPickerRows(400, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 4, presetsVisible: true }, null);
    expect(rows.swatches!.h).toBe(28); // 24 (row1, menu_btn nat: icon(16)+button.normal margin(8)) + 4 (separation) + 0 (row2, text contributes nothing)
  });
});

describe('colorPickerMinimumSize', () => {
  it('sums every visible row plus internal_margin\'s own content_margin on every side — color_picker.cpp:161-166', () => {
    const ctx: SolveContext = { theme: THEME, measureText, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
    expect(colorPickerMinimumSize(node({}), ctx)).toEqual({ x: 298, y: 568 });
  });

  it('drops the shape row contribution once picker_shape selects an undrawn shape', () => {
    expect(
      colorPickerMinimumSize(node({ pickerShape: 2, ...ALL_ROWS_HIDDEN }), CTX)
    ).toEqual({ x: 8, y: 8 });
  });

  it('each row-visibility flag moves the minimum size', () => {
    const baseY = minHeight(colorPickerMinimumSize(node({}), CTX));
    for (const flag of ['samplerVisible', 'colorModesVisible', 'slidersVisible', 'hexVisible', 'presetsVisible'] as const) {
      const withoutRow = minHeight(colorPickerMinimumSize(node({ [flag]: false }), CTX));
      expect(withoutRow, `${flag}=false must lower the minimum height`).toBeLessThan(baseY);
    }
  });

  it('edit_alpha and edit_intensity each move the minimum height', () => {
    const baseY = minHeight(colorPickerMinimumSize(node({}), CTX));
    expect(minHeight(colorPickerMinimumSize(node({ editAlpha: false }), CTX))).toBeLessThan(baseY);
    expect(minHeight(colorPickerMinimumSize(node({ editIntensity: false }), CTX))).toBeLessThan(baseY);
  });
});

describe('svAndHueRects', () => {
  it('splits the shape row into sv_square and hue_slider by h_width + separation', () => {
    const { svSquare, hueSlider } = svAndHueRects({ x: 0, y: 0, w: 400, h: 256 }, THEME);
    expect(svSquare).toEqual({ x: 0, y: 0, w: 366, h: 256 }); // 400 - 4 - 30
    expect(hueSlider).toEqual({ x: 370, y: 0, w: 30, h: 256 });
  });
});

describe('svSquareCursorPosition', () => {
  const SQUARE = { x: 10, y: 20, w: 100, h: 100 };

  it('places the cursor at s along x and (1-v) along y — color_picker_shape.cpp:259-261', () => {
    expect(svSquareCursorPosition(SQUARE, 0.5, 0.25)).toEqual({ x: 60, y: 95 });
  });

  it('clamps to the square bounds at s=0, v=1', () => {
    expect(svSquareCursorPosition(SQUARE, 0, 1)).toEqual({ x: 10, y: 20 });
  });

  it('clamps to the square bounds at s=1, v=0', () => {
    expect(svSquareCursorPosition(SQUARE, 1, 0)).toEqual({ x: 110, y: 120 });
  });
});

describe('hueIndicatorY', () => {
  it('is proportional to h across the slider height — color_picker_shape.cpp:431', () => {
    expect(hueIndicatorY(256, 0.5)).toBe(128);
  });

  it('is 0 at h=0', () => {
    expect(hueIndicatorY(256, 0)).toBe(0);
  });
});

describe('hexRowColumns', () => {
  it('splits label(38)/text_type(28)/field(fill) — color_picker.cpp:2191-2222', () => {
    const cols = hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME);
    expect(cols.label).toEqual({ x: 0, y: 0, w: 38, h: 28 });
    expect(cols.textType).toEqual({ x: 42, y: 0, w: 28, h: 28 }); // 38 + sep(4)
    expect(cols.field).toEqual({ x: 74, y: 0, w: 326, h: 28 }); // 42 + 28 + sep(4); 400 - 74
  });
});

describe('modeRowButtonRects', () => {
  it('splits 3 equal-width buttons + a fixed-width dropdown — color_picker.cpp:2129-2154', () => {
    const cols = modeRowButtonRects({ x: 0, y: 0, w: 400, h: 20 }, THEME);
    expect(cols.buttons).toEqual([
      { x: 0, y: 0, w: 120, h: 20 },
      { x: 124, y: 0, w: 120, h: 20 },
      { x: 248, y: 0, w: 120, h: 20 },
    ]);
    expect(cols.dropdown).toEqual({ x: 372, y: 0, w: 28, h: 20 });
  });
});

describe('swatchesRowRects', () => {
  it('splits palette_box (Swatches + menu_btn) then btn_recent_preset — color_picker.cpp:2239-2287', () => {
    const cols = swatchesRowRects({ x: 0, y: 0, w: 400, h: 44 }, THEME);
    // menu_btn's own natural width: icon(16) + button.normal margin(8) = 24, not the 16px icon alone.
    expect(cols.swatchesButton).toEqual({ x: 0, y: 0, w: 372, h: 20 }); // 400 - sep(4) - menuBtn(24)
    expect(cols.menuButton).toEqual({ x: 376, y: 0, w: 24, h: 20 });
    expect(cols.recentColorsButton).toEqual({ x: 0, y: 24, w: 400, h: 20 }); // 20 + sep(4)
  });
});

describe('colorPickerValueColumnWidth', () => {
  // spin_box.cpp:82-86: line_edit->get_combined_minimum_size() + buttons_block_width.
  it('is the LineEdit style margin(8) + 4*em("W")(10) + the SpinBox buttons block(18)', () => {
    expect(colorPickerValueColumnWidth(THEME, measure)).toBe(66); // 8 + 40 + 18
  });

  it('floors to the style margin + buttons block alone with no measurer', () => {
    expect(colorPickerValueColumnWidth(THEME, null)).toBe(26); // 8 + 0 + 18
  });
});

describe('colorPickerHexFieldMinWidth', () => {
  // line_edit.cpp:2443-2477, a plain LineEdit — no SpinBox buttons block.
  it('is the LineEdit style margin(8) + 4*em("W")(10), no buttons block', () => {
    expect(colorPickerHexFieldMinWidth(THEME, measure)).toBe(48); // 8 + 40
  });
});

describe('colorPickerMenuButtonSize', () => {
  // button.cpp:481-523: icon(16) + flat_button_normal's margin (button_normal's own, 4+4 per axis).
  it('is the 16px menu_option icon plus button.normal\'s own content margin', () => {
    expect(colorPickerMenuButtonSize(THEME)).toEqual({ x: 24, y: 24 });
  });
});

describe('colorPickerLabelColumnWidth', () => {
  it('floors to label_width(10) when no letter is wider', () => {
    expect(colorPickerLabelColumnWidth(THEME, measure, ['R', 'G', 'B'])).toBe(10);
  });

  it('widens to the widest label\'s own shaped text past the 10px floor', () => {
    const wide = (text: string) => ({ x: text.length * 15, y: 20 });
    expect(colorPickerLabelColumnWidth(THEME, wide, ['R', 'G', 'B'])).toBe(15);
  });

  it('floors to label_width with no measurer', () => {
    expect(colorPickerLabelColumnWidth(THEME, null, ['R', 'G', 'B'])).toBe(10);
  });
});

describe('colorPickerModeButtonStyleBox', () => {
  // color_picker.cpp:2060-2061: BIND_THEME_ITEM_EXT to TabContainer's tab_unselected/tab_selected.
  it('picks tab_unselected (black 60%) when not pressed', () => {
    expect(colorPickerModeButtonStyleBox(THEME, false).bgColor).toEqual({ r: 0, g: 0, b: 0, a: 0.6 });
  });

  it('picks tab_selected (dark grey 60%, top border) when pressed', () => {
    const box = colorPickerModeButtonStyleBox(THEME, true);
    expect(box.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
    expect(box.borderWidth.top).toBe(2);
  });

  it('both states share the same content margin (10,4,10,4)', () => {
    expect(colorPickerModeButtonStyleBox(THEME, false).contentMargin).toEqual(colorPickerModeButtonStyleBox(THEME, true).contentMargin);
  });
});

describe('colorPickerSliderBoxRect', () => {
  // slider.cpp:35-44 (Slider::get_minimum_size), SIZE_SHRINK_CENTER within the taller grid cell.
  it('centres the slider at its own natural height inside a taller cell', () => {
    expect(colorPickerSliderBoxRect({ x: 0, y: 0, w: 400, h: 28 }, THEME, { x: 16, y: 16 })).toEqual({ x: 0, y: 6, w: 400, h: 16 }); // (28-16)/2
  });

  // control.h fit_child_in_rect: Math::floor, not a bare /2 — an odd
  // remainder floors DOWN, it does not round to the nearest pixel.
  it('floors an odd remainder — control.h fit_child_in_rect', () => {
    expect(colorPickerSliderBoxRect({ x: 0, y: 0, w: 400, h: 29 }, THEME, { x: 16, y: 16 }).y).toBe(6); // floor(13/2)=6, not 7
  });
});

describe('colorPickerIntensityRatio', () => {
  // color_picker.cpp:2183-2185: intensity_slider min=-10, max=10.
  it('is 0.5 at value=0 (the range midpoint)', () => {
    expect(colorPickerIntensityRatio(0)).toBe(0.5);
  });

  it('is 0 at min and 1 at max', () => {
    expect(colorPickerIntensityRatio(-10)).toBe(0);
    expect(colorPickerIntensityRatio(10)).toBe(1);
  });
});

describe('colorPickerChannelGrabberRect', () => {
  // slider.cpp:322-334,363, center_grabber=true branch: areasize is the FULL
  // width, grabber_shift = -grabber_width/2 centres the icon ON the ratio point.
  it('centres the 16px grabber on the ratio point, offset down by grabber_offset', () => {
    const r = colorPickerChannelGrabberRect({ x: 400, y: 16 }, 0.5, { x: 16, y: 16 }, 8);
    expect(r).toEqual({ x: 192, y: 8, w: 16, h: 16 }); // 0.5*400-8=192; 16/2-16/2+8=8
  });

  it('extends half off the left edge at ratio=0', () => {
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 0, { x: 16, y: 16 }, 8).x).toBe(-8);
  });

  it('extends half off the right edge at ratio=1', () => {
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 1, { x: 16, y: 16 }, 8).x).toBe(392);
  });
});

describe('sliderGridRowRects', () => {
  it('splits label(10)/slider(fill)/value(48) per row, stacked with the grid\'s own v_separation — color_picker.cpp:2172-2180', () => {
    // labelWidth/valueWidth are the caller's own (colorPickerLabelColumnWidth/
    // colorPickerValueColumnWidth) — this test exercises the column SPLIT only.
    const rows = sliderGridRowRects({ x: 0, y: 0, w: 400, h: 156 }, 5, THEME, 10, 48);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      label: { x: 0, y: 0, w: 10, h: 28 },
      slider: { x: 14, y: 0, w: 334, h: 28 }, // 400 - 10 - 48 - 2*sep(4)
      value: { x: 352, y: 0, w: 48, h: 28 },
    });
    expect(rows[1]!.label.y).toBe(32); // 28 + sep(4)
    expect(rows[4]!.label.y).toBe(128); // 4 * 32
  });
});

/**
 * `layout_direction = RTL` on a ColorPicker. `color_picker.cpp` never calls
 * `is_layout_rtl()` at all: the whole widget tree is built from ordinary
 * containers in the constructor, and each one mirrors its OWN row.
 * `BoxContainer::_resort` walks an RTL horizontal box's children in REVERSE
 * and lays them out left to right (`box_container.cpp:184-192`);
 * `GridContainer` starts `col_ofs` at the grid's right edge and walks left
 * (`grid_container.cpp:193-197,218-223`). `Container::fit_child_in_rect` is
 * not a second mirror — `Control::set_rect` pre-mirrors through
 * `_compute_offsets` (`control.cpp:904-915`) exactly as much as
 * `_size_changed` mirrors back (`:1785-1787`), so a child lands where its
 * container put it either way.
 *
 * Every expectation below is that reverse walk done by hand, never the
 * implementation's own mirror applied twice.
 */
describe('RTL rows (box_container.cpp:184-192, grid_container.cpp:193-197,218-223)', () => {
  it('svAndHueRects puts hue_slider first, at the left edge', () => {
    // Reverse walk of [sv_square, hue_slider] at 400 wide: hue(30) at 0,
    // sep(4), sv(366) at 34, ending at 400.
    const { svSquare, hueSlider } = svAndHueRects({ x: 0, y: 0, w: 400, h: 256 }, THEME, true);
    expect(hueSlider).toEqual({ x: 0, y: 0, w: 30, h: 256 });
    expect(svSquare).toEqual({ x: 34, y: 0, w: 366, h: 256 });
  });

  it('hexRowColumns puts the field first and hex_label last', () => {
    // Reverse walk of [hex_label, text_type, c_text]: field(326) at 0, sep(4),
    // text_type(28) at 330, sep(4), label(38) at 362, ending at 400.
    const cols = hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME, true);
    expect(cols.field).toEqual({ x: 0, y: 0, w: 326, h: 28 });
    expect(cols.textType).toEqual({ x: 330, y: 0, w: 28, h: 28 });
    expect(cols.label).toEqual({ x: 362, y: 0, w: 38, h: 28 });
  });

  it('modeRowButtonRects puts btn_mode first and RGB last', () => {
    // Reverse walk of [RGB, HSV, Linear, btn_mode]: dropdown(28) at 0, sep(4),
    // Linear(120) at 32, sep, HSV at 156, sep, RGB at 280, ending at 400.
    const cols = modeRowButtonRects({ x: 0, y: 0, w: 400, h: 20 }, THEME, true);
    expect(cols.dropdown).toEqual({ x: 0, y: 0, w: 28, h: 20 });
    expect(cols.buttons).toEqual([
      { x: 280, y: 0, w: 120, h: 20 },
      { x: 156, y: 0, w: 120, h: 20 },
      { x: 32, y: 0, w: 120, h: 20 },
    ]);
  });

  it('swatchesRowRects puts menu_btn first, and leaves the full-width second row alone', () => {
    // palette_box reverse walk: menu_btn(24) at 0, sep(4), btn_preset(372) at
    // 28. `btn_recent_preset` spans the whole row, so its own mirror is the
    // identity.
    const cols = swatchesRowRects({ x: 0, y: 0, w: 400, h: 44 }, THEME, true);
    expect(cols.menuButton).toEqual({ x: 0, y: 0, w: 24, h: 20 });
    expect(cols.swatchesButton).toEqual({ x: 28, y: 0, w: 372, h: 20 });
    expect(cols.recentColorsButton).toEqual({ x: 0, y: 24, w: 400, h: 20 });
  });

  it('sliderGridRowRects starts each row at the grid\'s right edge and walks left', () => {
    // `col_ofs = get_size().width` (400): label(10) at 390, col_ofs 386;
    // slider(334) at 52, col_ofs 48; value(48) at 0.
    const rows = sliderGridRowRects({ x: 0, y: 0, w: 400, h: 156 }, 5, THEME, 10, 48, true);
    expect(rows[0]).toEqual({
      label: { x: 390, y: 0, w: 10, h: 28 },
      slider: { x: 52, y: 0, w: 334, h: 28 },
      value: { x: 0, y: 0, w: 48, h: 28 },
    });
    // Rows still stack downward: only the COLUMN axis mirrors.
    expect(rows[4]!.label.y).toBe(128);
  });

  it('sampleRowColumns puts btn_shape first and btn_pick last', () => {
    // Reverse walk of [btn_pick, sample, btn_shape]: shape(28) at 0, sep(4),
    // sample(336) at 32, sep(4), pick(28) at 372.
    const cols = sampleRowColumns({ x: 0, y: 0, w: 400, h: 24 }, THEME, 0, true);
    expect(cols.shape).toEqual({ x: 0, y: 0, w: 28, h: 24 });
    expect(cols.sample).toEqual({ x: 32, y: 0, w: 336, h: 24 });
    expect(cols.pick).toEqual({ x: 372, y: 0, w: 28, h: 24 });
  });

  it('colorPickerChannelGrabberRect reads the ratio from the right — slider.cpp:363', () => {
    // `(rtl ? 1 - ratio : ratio) * areasize + grabber_shift`, the SAME branch
    // the stock grabber already takes (`shared/sliderSolver.ts`).
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 0, { x: 16, y: 16 }, 8, true).x).toBe(392);
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 1, { x: 16, y: 16 }, 8, true).x).toBe(-8);
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 0.5, { x: 16, y: 16 }, 8, true).x).toBe(192);
  });

  it('leaves every row where it was under LTR', () => {
    expect(hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME, false)).toEqual(hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME));
    expect(sampleRowColumns({ x: 0, y: 0, w: 400, h: 24 }, THEME, 0, false)).toEqual(sampleRowColumns({ x: 0, y: 0, w: 400, h: 24 }, THEME, 0));
  });
});

describe('sampleRowColumns', () => {
  const SAMPLE = { x: 0, y: 0, w: 400, h: 24 };

  it('splits pick(28)/sample(fill)/shape(28) at the default picker_shape', () => {
    const cols = sampleRowColumns(SAMPLE, THEME, 0);
    expect(cols.pick).toEqual({ x: 0, y: 0, w: 28, h: 24 });
    expect(cols.sample).toEqual({ x: 32, y: 0, w: 336, h: 24 }); // 400 - 28 - 4 - 32
    expect(cols.shape).toEqual({ x: 372, y: 0, w: 28, h: 24 });
  });

  it('drops the shape button at SHAPE_NONE (4) — color_picker.cpp:321', () => {
    const cols = sampleRowColumns(SAMPLE, THEME, 4);
    expect(cols.shape).toBeNull();
    expect(cols.sample.w).toBe(368); // 400 - 28 - 4
  });
});
