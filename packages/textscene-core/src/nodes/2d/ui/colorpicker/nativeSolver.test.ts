import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import {
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
  presetButtonContent,
  modeButtonLabel,
  textTypeLabel,
  sliderGridRowRects,
  colorPickerValueColumnWidth,
  colorPickerLabelColumnWidth,
  colorPickerModeButtonStyleBox,
  colorPickerSliderBoxRect,
  colorPickerChannelGrabberRect,
  colorPickerIntensityRatio,
  colorPickerEmWidthPx,
} from './nativeSolver';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import { measureText as measureTextWithFont } from '../../../../r3f/controls/native/text/measurer';

const THEME = nativeTheme(1);
const CTX: SolveContext = { theme: THEME, measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = controlNode('P', 'ColorPicker', properties);
  return { ...emptySolveNode(), path: 'P', node: tscnNode };
}

/** Every assertion below is on the height alone. */
function minHeight(result: ReturnType<typeof colorPickerMinimumSize>): number {
  return result.y;
}

describe('invertRgb', () => {
  it('flips rgb and leaves alpha: core/math/color.h Color::inverted()', () => {
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

  it('normalises an overbright colour before extracting h/s/v: color_picker.cpp:593-602', () => {
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

  it("reads the theme's own raw scale", () => {
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

// A stand-in for `ctx.measureText`: 10px per character and 20px tall, so each
// expected number can be checked by hand.
const measure = (text: string) => ({ x: text.length * 10, y: 20 });
const measureText: SolveContext['measureText'] = (text) => measure(text);

describe('colorPickerRows', () => {
  it('sizes the shape row from sv_width/sv_height/h_width at scale 1: default_theme.cpp:1077-1079, no other row present', () => {
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
    const wheel = colorPickerRows(
      400,
      THEME,
      { ...ALL_ROWS_HIDDEN, pickerShape: 1, samplerVisible: true },
      null
    );
    expect(wheel.shape).toBeNull();
    expect(wheel.sample).toEqual({ x: 0, y: 4, w: 400, h: 24 });
  });

  it('draws no shape row for SHAPE_NONE (4): matches Godot exactly, not a gap', () => {
    expect(colorPickerRows(400, THEME, { ...ALL_ROWS_HIDDEN, pickerShape: 4 }, null).shape).toBeNull();
  });

  it('drops every hidden row AND its separation gap: color_picker.cpp:1906-1956', () => {
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
    // swatches: each Button is max(text(20), icon(16)) + button.normal margin(8) = 28 (Godot 31 at text 23),
    // so 28 + sep(4) + 28 = 60 tall.
    expect(rows.swatches).toEqual({ x: 0, y: 512, w: 400, h: 60 });
    expect(rows.totalHeight).toBe(572);
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

  it("swatches rows floor to a Button's 16px icon plus its margin even with no text measurer", () => {
    // `btn_preset` and `btn_recent_preset` each hold the `folded_arrow` icon, also with no `measure`.
    const rows = colorPickerRows(
      400,
      THEME,
      { ...ALL_ROWS_HIDDEN, pickerShape: 4, presetsVisible: true },
      null
    );
    expect(rows.swatches!.h).toBe(52); // 24 (icon(16) + button.normal margin(8)) + 4 (separation) + 24
  });
});

describe('colorPickerMinimumSize', () => {
  it("sums every visible row plus internal_margin's own content_margin on every side: color_picker.cpp:161-166", () => {
    const ctx: SolveContext = { theme: THEME, measureText, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
    expect(colorPickerMinimumSize(node({}), ctx)).toEqual({ x: 298, y: 580 });
  });

  it('sizes the swatches rows as Buttons with the folded_arrow icon: "Swatches" 10px/char gives 108 and "Recent Colors" 158', () => {
    // btn_preset 80 + sep(4) + icon(16) + margin(8) = 108. Row 1 adds sep(4) + menu_btn(24) = 136. btn_recent_preset 130 + 28 = 158.
    const ctx: SolveContext = { theme: THEME, measureText, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
    const swatchesOnly = node({ ...ALL_ROWS_HIDDEN, pickerShape: 4, presetsVisible: true });
    expect(colorPickerMinimumSize(swatchesOnly, ctx).x).toBe(158 + 8);
  });

  it('drops the shape row contribution once picker_shape selects an undrawn shape', () => {
    expect(colorPickerMinimumSize(node({ pickerShape: 2, ...ALL_ROWS_HIDDEN }), CTX)).toEqual({ x: 8, y: 8 });
  });

  it('each row-visibility flag moves the minimum size', () => {
    const baseY = minHeight(colorPickerMinimumSize(node({}), CTX));
    for (const flag of [
      'samplerVisible',
      'colorModesVisible',
      'slidersVisible',
      'hexVisible',
      'presetsVisible',
    ] as const) {
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

  it('places the cursor at s along x and (1-v) along y: color_picker_shape.cpp:259-261', () => {
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
  it('is proportional to h across the slider height: color_picker_shape.cpp:431', () => {
    expect(hueIndicatorY(256, 0.5)).toBe(128);
  });

  it('truncates to the whole pixel row, as the int y does', () => {
    expect(hueIndicatorY(256, 0.6)).toBe(153);
  });

  it('is 0 at h=0', () => {
    expect(hueIndicatorY(256, 0)).toBe(0);
  });
});

describe('hexRowColumns', () => {
  it('splits label(38)/text_type(28)/field(fill): color_picker.cpp:2191-2222', () => {
    const cols = hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME);
    expect(cols.label).toEqual({ x: 0, y: 0, w: 38, h: 28 });
    expect(cols.textType).toEqual({ x: 42, y: 0, w: 28, h: 28 }); // 38 + sep(4)
    expect(cols.field).toEqual({ x: 74, y: 0, w: 326, h: 28 }); // 42 + 28 + sep(4); 400 - 74
  });
});

const NO_LABEL_WIDTHS = [0, 0, 0];

describe('modeRowButtonRects', () => {
  it('splits 3 equal-width buttons + a fixed-width dropdown: color_picker.cpp:2129-2154', () => {
    const cols = modeRowButtonRects({ x: 0, y: 0, w: 400, h: 20 }, THEME, false, NO_LABEL_WIDTHS);
    expect(cols.buttons).toEqual([
      { x: 0, y: 0, w: 120, h: 20 },
      { x: 124, y: 0, w: 120, h: 20 },
      { x: 248, y: 0, w: 120, h: 20 },
    ]);
    expect(cols.dropdown).toEqual({ x: 372, y: 0, w: 28, h: 20 });
  });
});

describe('modeRowButtonRects with a label wider than its share', () => {
  it('keeps that button at its minimum and shares the rest (box_container.cpp:100-130)', () => {
    const cols = modeRowButtonRects({ x: 0, y: 0, w: 300, h: 20 }, THEME, false, [120, 10, 10]);
    expect(cols.buttons[0]!.w).toBeGreaterThanOrEqual(120);
    expect(cols.buttons[1]!.w).toBeLessThan(cols.buttons[0]!.w);
    expect(cols.dropdown.x + cols.dropdown.w).toBe(300);
  });
});

describe('modeRowButtonRects with a fractional label width', () => {
  it('reserves the shaped, whole-pixel width of the text (text_server_adv.cpp:7524-7537)', () => {
    const fractional = modeRowButtonRects({ x: 0, y: 0, w: 300, h: 20 }, THEME, false, [120.2, 10, 10]);
    const whole = modeRowButtonRects({ x: 0, y: 0, w: 300, h: 20 }, THEME, false, [121, 10, 10]);
    expect(fractional.buttons).toEqual(whole.buttons);
  });
});

describe('modeRowButtonRects at a fractional share', () => {
  it('gives every button whole pixels and ends flush with the row: box_container.cpp:100-130', () => {
    const cols = modeRowButtonRects({ x: 0, y: 0, w: 401, h: 20 }, THEME, false, NO_LABEL_WIDTHS);
    const rects = [...cols.buttons, cols.dropdown];
    for (const r of rects) {
      expect(Number.isInteger(r.x)).toBe(true);
      expect(Number.isInteger(r.w)).toBe(true);
    }
    expect(cols.dropdown.x + cols.dropdown.w).toBe(401);
  });
});

describe('swatchesRowRects', () => {
  it('splits palette_box (Swatches + menu_btn) then btn_recent_preset: color_picker.cpp:2239-2287', () => {
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
    expect(colorPickerValueColumnWidth(THEME, 10)).toBe(66); // 8 + 40 + 18
  });

  it('truncates the fractional minimum as GridContainer does: Godot measures 86.5 as an 86px column', () => {
    expect(colorPickerValueColumnWidth(THEME, 15.125)).toBe(86); // 8 + 60.5 + 18 = 86.5
  });

  it('floors to the style margin + buttons block alone with no em width', () => {
    expect(colorPickerValueColumnWidth(THEME, 0)).toBe(26); // 8 + 0 + 18
  });

  it("ends a 300px picker's band at x=210 and starts its value field at x=214, as pnpm ref:godot measures", () => {
    const [row] = sliderGridRowRects(
      { x: 8, y: 0, w: 292, h: 20 },
      1,
      THEME,
      13,
      colorPickerValueColumnWidth(THEME, 15.125)
    );
    expect(row!.slider.x + row!.slider.w).toBe(210);
    expect(row!.value.x).toBe(214);
  });
});

describe('colorPickerMinimumSize of the hex row alone', () => {
  // line_edit.cpp:2443-2477: c_text is a plain LineEdit, with no SpinBox buttons block.
  const HEX_ONLY = { pickerShape: 2, ...ALL_ROWS_HIDDEN, hexVisible: true };

  it('is label(38) + 2 separations(8) + text_type(28) + the LineEdit margin(8) + 4*em("W")(40)', () => {
    const ctx: SolveContext = { theme: THEME, measureText, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
    expect(colorPickerMinimumSize(node(HEX_ONLY), ctx).x).toBe(122 + 8); // + internal_margin on both sides
  });

  it('floors the field to the LineEdit margin alone with no measurer', () => {
    expect(colorPickerMinimumSize(node(HEX_ONLY), CTX).x).toBe(82 + 8);
  });
});

describe('colorPickerLabelColumnWidth', () => {
  it('floors to label_width(10) when no letter is wider', () => {
    expect(colorPickerLabelColumnWidth(THEME, measure, ['R', 'G', 'B'])).toBe(10);
  });

  it("widens to the widest label's own shaped text past the 10px floor", () => {
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
    expect(colorPickerModeButtonStyleBox(THEME, false).contentMargin).toEqual(
      colorPickerModeButtonStyleBox(THEME, true).contentMargin
    );
  });
});

describe('colorPickerSliderBoxRect', () => {
  // slider.cpp:35-44 (Slider::get_minimum_size), SIZE_SHRINK_CENTER within the taller grid cell.
  it('centres the slider at its own natural height inside a taller cell', () => {
    expect(colorPickerSliderBoxRect({ x: 0, y: 0, w: 400, h: 28 }, THEME, { x: 16, y: 16 })).toEqual({
      x: 0,
      y: 6,
      w: 400,
      h: 16,
    }); // (28-16)/2
  });

  // control.h fit_child_in_rect uses Math::floor, so an odd remainder floors down.
  it('floors an odd remainder: control.h fit_child_in_rect', () => {
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
  // slider.cpp:322-334,363, center_grabber=true branch: areasize is the full
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
  it("splits label(10)/slider(fill)/value(48) per row, stacked with the grid's own v_separation: color_picker.cpp:2172-2180", () => {
    // The caller supplies labelWidth and valueWidth. This test covers the column split only.
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
 * `layout_direction = RTL`: `color_picker.cpp` never calls `is_layout_rtl()`, and each container mirrors its row
 * (`box_container.cpp:184-192`, `grid_container.cpp:193-197,218-223`), with no second mirror
 * (`control.cpp:904-915`, `:1785-1787`). Each expectation is the reverse walk done by
 * hand, not the implementation's mirror.
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
    const cols = modeRowButtonRects({ x: 0, y: 0, w: 400, h: 20 }, THEME, true, NO_LABEL_WIDTHS);
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

  it("sliderGridRowRects starts each row at the grid's right edge and walks left", () => {
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

  it('colorPickerChannelGrabberRect reads the ratio from the right: slider.cpp:363', () => {
    // `(rtl ? 1 - ratio : ratio) * areasize + grabber_shift`, the same branch
    // the stock grabber already takes (`shared/sliderSolver.ts`).
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 0, { x: 16, y: 16 }, 8, true).x).toBe(392);
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 1, { x: 16, y: 16 }, 8, true).x).toBe(-8);
    expect(colorPickerChannelGrabberRect({ x: 400, y: 16 }, 0.5, { x: 16, y: 16 }, 8, true).x).toBe(192);
  });

  it('leaves every row where it was under LTR', () => {
    expect(hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME, false)).toEqual(
      hexRowColumns({ x: 0, y: 0, w: 400, h: 28 }, THEME)
    );
    expect(sampleRowColumns({ x: 0, y: 0, w: 400, h: 24 }, THEME, 0, false)).toEqual(
      sampleRowColumns({ x: 0, y: 0, w: 400, h: 24 }, THEME, 0)
    );
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

  it('drops the shape button at SHAPE_NONE (4): color_picker.cpp:321', () => {
    const cols = sampleRowColumns(SAMPLE, THEME, 4);
    expect(cols.shape).toBeNull();
    expect(cols.sample.w).toBe(368); // 400 - 28 - 4
  });
});

describe('presetButtonContent', () => {
  // btn_preset and btn_recent_preset: a Button with the folded_arrow icon at the left, LEFT text, margin 4 (button.cpp:349-405).
  const box = { x: 10, y: 20, w: 366, h: 31 };
  const text = { x: 73, y: 23 };

  it('puts the icon at the left margin and the text after it, as pnpm ref:godot measures the rows', () => {
    const { icon, label } = presetButtonContent(box, THEME, {
      size: text,
      direction: { rtl: false, isTextRtl: false },
    });
    // y: floor((31 - 8 - 16) / 2) = 3, plus margin 4.
    expect(icon).toEqual({ x: 14, y: 27, w: 16, h: 16 });
    // x: margin 4 + icon 16 + h_separation 4 = 24 into the box, and 366 - 8 - 20 = 338 wide.
    expect(label).toMatchObject({ leftPx: 34, widthPx: 338 });
  });

  it('mirrors in a right-to-left layout: the icon on the trailing edge, the text from the leading margin', () => {
    const { icon, label } = presetButtonContent(box, THEME, {
      size: text,
      direction: { rtl: true, isTextRtl: false },
    });
    expect(icon).toEqual({ x: 356, y: 27, w: 16, h: 16 });
    expect(label).toMatchObject({ leftPx: 14, widthPx: 338 });
  });
});

describe('colorPickerEmWidthPx', () => {
  it('gives the painter (shapeButtonLabel) and the solver (measureText) the same em', () => {
    const fontSizePx = THEME.fontSize;
    const painterEm = colorPickerEmWidthPx(
      (text) => shapeButtonLabel(text, { fontSizePx, fontMetrics: OPEN_SANS_FONT_METRICS }).widthPx
    );
    const solverEm = colorPickerEmWidthPx(
      (text) => measureTextWithFont(text, fontSizePx, 0, OPEN_SANS_FONT_METRICS).x
    );
    expect(painterEm).toBe(solverEm);
    expect(painterEm).toBeGreaterThan(0);
  });
});

describe('modeButtonLabel', () => {
  const box = { x: 100.5, y: 300, w: 120.25, h: 31 };
  const text = { x: 41, y: 23 };
  const direction = { rtl: false, isTextRtl: false };

  it('centres the text in the drawable width after the style margins', () => {
    const label = modeButtonLabel(box, THEME, false, { size: text, direction });
    expect(label.alignment).toBe(1);
    expect(label.leftPx).toBeGreaterThan(box.x);
    expect(label.widthPx).toBeLessThan(box.w);
  });

  it.each([false, true])('starts the box at the left margin of the style (pressed: %s)', (isPressed) => {
    const label = modeButtonLabel(box, THEME, isPressed, { size: text, direction });
    expect(label.leftPx).toBe(box.x + colorPickerModeButtonStyleBox(THEME, isPressed).contentMargin.left);
  });
});

describe('textTypeLabel', () => {
  it('centres the "#" with the button_normal margins', () => {
    const box = { x: 700, y: 510, w: 28, h: 31 };
    const label = textTypeLabel(box, THEME, {
      size: { x: 10, y: 23 },
      direction: { rtl: false, isTextRtl: false },
    });
    expect(label.leftPx).toBe(box.x + THEME.widgets.button.normal.contentMargin.left);
    expect(label.alignment).toBe(1);
  });
});
