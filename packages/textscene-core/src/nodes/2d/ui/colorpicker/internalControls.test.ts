/** The Controls a ColorPicker builds (`color_picker.cpp:2070-2307`), what it sets on them, and the size they give it. */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { createSolveContext } from '../../../../r3f/controls/native/controlRectSolver';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { COLOR_PICKER_BAR_ARROW_ICON } from '../../../../r3f/controls/native/themeIcons';
import { themeItemsOfType } from '../../../../r3f/controls/native/themeItems';
import { ColorPickerColorMode, ColorPickerShape } from '../../../../godot/scene/gui';
import type { ButtonProperties } from '../button/types';
import type { LineEditProperties } from '../lineedit/types';
import type { SpinBoxProperties } from '../spinbox/types';
import type { HSliderProperties } from '../hslider/types';
import { ChannelGradientDraw } from './draws/ChannelGradientDraw';
import { SampleDraw } from './draws/SampleDraw';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import type { ColorPickerProperties } from './types';
import '../../../../parser/TscnParser';
import '../../../../r3f/controls/index';

const THEME = nativeTheme(1);

function picker(props: Partial<ColorPickerProperties> = {}): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'Picker',
    node: controlNode('Picker', 'ColorPicker', { name: 'Picker', color: 'Color(1, 1, 1, 1)', ...props }),
  });
}

function internalMargin(n: SolveNode): SolveNode {
  const [margin, ...rest] = internalControlsOf(n, THEME);
  expect(rest).toEqual([]);
  return margin!.node;
}

/** The Control at `path` under `internal_margin`, by the names Godot's members carry. */
function at(n: SolveNode, ...path: string[]): SolveNode {
  let node = internalMargin(n).children[0]!;
  for (const name of path) {
    const child = node.children.find((c) => c.node.name === name);
    if (!child) throw new Error(`expected a Control called ${name} under ${node.node.name}, found none`);
    node = child;
  }
  return node;
}

const propsOf = <P>(n: SolveNode) => n.node.properties as P;
const names = (n: SolveNode) => n.children.map((c) => c.node.name);
const isShown = (n: SolveNode) => propsOf<{ visible?: boolean }>(n).visible !== false;

describe('the Controls a ColorPicker builds', () => {
  it('adds internal_margin, holding real_vbox with the rows in order (color_picker.cpp:2071-2304)', () => {
    const margin = internalMargin(picker());
    expect(margin.node.type).toBe('MarginContainer');
    expect(margin.path).toBe('Picker/@internal_margin');
    expect(names(margin.children[0]!)).toEqual([
      'shape_container',
      'sample_hbc',
      'mode_hbc',
      'slider_gc',
      'hex_hbc',
      'swatches_vbc',
      'perm_hb',
    ]);
  });

  it("pushes the picker's margin onto every side of internal_margin (:161-166)", () => {
    const { constants } = internalMargin(picker());
    const margin = picker().constants.margin;
    expect([
      constants.margin_left,
      constants.margin_top,
      constants.margin_right,
      constants.margin_bottom,
    ]).toEqual([margin, margin, margin, margin]);
  });

  it.each([
    ['samplerVisible', 'sample_hbc'],
    ['colorModesVisible', 'mode_hbc'],
    ['slidersVisible', 'slider_gc'],
    ['hexVisible', 'hex_hbc'],
    ['presetsVisible', 'swatches_vbc'],
  ] as const)('hides only %s’s row, %s, when the flag is off', (flag, row) => {
    const n = picker({ [flag]: false });
    expect(isShown(at(n, row))).toBe(false);
    expect(names(at(n)).filter((name) => !isShown(at(n, name)))).toEqual([row, 'perm_hb']);
  });

  it('keeps the screen recording notice hidden (:2304)', () => {
    expect(isShown(at(picker(), 'perm_hb'))).toBe(false);
  });
});

describe('the shape row', () => {
  it('holds the Controls of the current shape only (:308-318)', () => {
    expect(names(at(picker(), 'shape_container'))).toEqual(['sv_square', 'hue_slider']);
    expect(names(at(picker({ pickerShape: ColorPickerShape.SHAPE_HSV_WHEEL }), 'shape_container'))).toEqual([
      'wheel',
    ]);
  });

  it('keeps its slot but holds nothing at SHAPE_NONE, and hides btn_shape (:321)', () => {
    const n = picker({ pickerShape: ColorPickerShape.SHAPE_NONE });
    expect(isShown(at(n, 'shape_container'))).toBe(true);
    expect(names(at(n, 'shape_container'))).toEqual([]);
    expect(isShown(at(n, 'sample_hbc', 'btn_shape'))).toBe(false);
  });

  it("sizes the shape area at the picker's sv_width by sv_height and the slider at h_width (color_picker_shape.cpp:463-466)", () => {
    const n = picker();
    const { sv_width, sv_height, h_width } = n.constants;
    expect(
      propsOf<{ customMinimumSize?: unknown }>(at(n, 'shape_container', 'sv_square')).customMinimumSize
    ).toEqual({
      x: sv_width,
      y: sv_height,
    });
    expect(
      propsOf<{ customMinimumSize?: unknown }>(at(n, 'shape_container', 'hue_slider')).customMinimumSize
    ).toEqual({
      x: h_width,
      y: 0,
    });
  });
});

describe('the sample row', () => {
  it('draws the pick colour on sample through its draw callback (:2091)', () => {
    const sample = at(picker({ color: 'Color(1, 0, 0, 0.5)' }), 'sample_hbc', 'sample');
    expect(sample.draws).toBe(SampleDraw);
    expect(propsOf<{ pickColor: unknown }>(sample).pickColor).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
  });

  it('gives btn_pick the screen_picker icon, centred, at least 28 px wide (:114,122)', () => {
    const pick = propsOf<ButtonProperties & { customMinimumSize?: unknown }>(
      at(picker(), 'sample_hbc', 'btn_pick')
    );
    expect(pick.themeIcon?.name).toBe('screen_picker');
    expect(pick.iconAlignment).toBe(1);
    expect(pick.customMinimumSize).toEqual({ x: 28, y: 0 });
  });

  it("gives btn_shape the shape's icon and the FlatMenuButton variation, not flat (:2094-2101)", () => {
    const shape = at(picker({ pickerShape: ColorPickerShape.SHAPE_VHS_CIRCLE }), 'sample_hbc', 'btn_shape');
    const props = propsOf<ButtonProperties>(shape);
    expect(shape.node.type).toBe('MenuButton');
    expect(props.themeIcon?.name).toBe('shape_circle');
    expect(props.themeTypeVariation).toBe('FlatMenuButton');
    expect(props.flat).toBe(false);
  });
});

describe('the mode row', () => {
  it.each([
    [0, [true, false, false]],
    [ColorPickerColorMode.MODE_LINEAR, [false, false, true]],
    [ColorPickerColorMode.MODE_OKHSL, [false, false, false]],
  ])(
    'presses the button of color_mode %s only, and OKHSL has none (:2142,1242-1260)',
    (colorMode, pressed) => {
      const row = at(picker({ colorMode }), 'mode_hbc');
      const buttons = row.children.slice(0, 3).map((b) => propsOf<ButtonProperties>(b));
      expect(buttons.map((b) => b.text)).toEqual(['RGB', 'HSV', 'Linear']);
      expect(buttons.map((b) => b.buttonPressed)).toEqual(pressed);
    }
  );

  it("pushes TabContainer's tab boxes onto each mode button (:154-160, :2060-2063)", () => {
    const n = picker();
    const tabs = themeItemsOfType(n, 'TabContainer').styleBoxes;
    const { styleBoxes } = at(n, 'mode_hbc', 'mode_btn_1');
    expect(styleBoxes.normal).toBe(tabs.tab_unselected);
    expect(styleBoxes.pressed).toBe(tabs.tab_selected);
  });
});

describe('the slider grid', () => {
  const grid = (props: Partial<ColorPickerProperties> = {}) => at(picker(props), 'slider_gc');

  it('holds a label, a slider and a value box for each of the five rows (:445-494)', () => {
    expect(names(grid()).slice(0, 6)).toEqual([
      'label_0',
      'slider_0',
      'value_0',
      'label_1',
      'slider_1',
      'value_1',
    ]);
    expect(grid().children).toHaveLength(15);
    expect(propsOf<{ columns?: number }>(grid()).columns).toBe(3);
  });

  it('labels the rows from the mode, then I and A (:283-291)', () => {
    const labels = (colorMode: number) =>
      [0, 1, 2, 3, 4].map(
        (i) => propsOf<{ text?: string }>(at(picker({ colorMode }), 'slider_gc', `label_${i}`)).text
      );
    expect(labels(0)).toEqual(['R', 'G', 'B', 'I', 'A']);
    expect(labels(ColorPickerColorMode.MODE_OKHSL)).toEqual(['H', 'S', 'L', 'I', 'A']);
  });

  it('gives a slider and its value box one range from the mode (:714-731)', () => {
    const n = picker({ color: 'Color(0.5, 0, 1, 1)' });
    const slider = propsOf<HSliderProperties>(at(n, 'slider_gc', 'slider_0'));
    const value = propsOf<SpinBoxProperties>(at(n, 'slider_gc', 'value_0'));
    expect([slider.maxValue, slider.step, slider.value, slider.allowGreater]).toEqual([255, 1, 127.5, true]);
    expect([value.maxValue, value.step, value.value, value.allowGreater]).toEqual([255, 1, 127.5, true]);
    expect(value.alignment).toBe(2);
  });

  it('runs alpha to 1 at step 0.001 in Linear mode (color_mode.h:120,127)', () => {
    const alpha = propsOf<HSliderProperties>(
      at(picker({ colorMode: ColorPickerColorMode.MODE_LINEAR }), 'slider_gc', 'slider_4')
    );
    expect([alpha.maxValue, alpha.step, alpha.allowGreater]).toEqual([1, 0.001, false]);
  });

  it('runs intensity from -10 to 10 with a "+" prefix at 0 (:2183-2187, :729)', () => {
    const intensity = propsOf<SpinBoxProperties>(at(picker(), 'slider_gc', 'value_3'));
    expect([intensity.minValue, intensity.maxValue, intensity.step, intensity.prefix]).toEqual([
      -10,
      10,
      0.001,
      '+',
    ]);
  });

  it.each([
    ['editAlpha', 4],
    ['editIntensity', 3],
  ] as const)('hides the three Controls of the row %s shows (:299-305)', (flag, row) => {
    const n = picker({ [flag]: false });
    const hidden = at(n, 'slider_gc')
      .children.filter((c) => !isShown(c))
      .map((c) => c.node.name);
    expect(hidden).toEqual([`label_${row}`, `slider_${row}`, `value_${row}`]);
  });

  it('gives each channel and the alpha slider the bar_arrow grabber, 8 px down and centred (:629-653, :146-149)', () => {
    const n = picker();
    for (const row of [0, 1, 2, 4]) {
      const slider = at(n, 'slider_gc', `slider_${row}`);
      expect(slider.defaultIcons).toEqual({
        grabber: COLOR_PICKER_BAR_ARROW_ICON,
        grabber_highlight: COLOR_PICKER_BAR_ARROW_ICON,
      });
      expect(slider.constants.grabber_offset).toBe(8);
      expect(slider.constants.center_grabber).toBe(n.constants.center_slider_grabbers);
      expect(slider.draws).toBe(ChannelGradientDraw);
    }
  });

  it('leaves the intensity slider its own grabber and no gradient (:477-481)', () => {
    const slider = at(picker(), 'slider_gc', 'slider_3');
    expect(slider.defaultIcons).toBeUndefined();
    expect(slider.constants.grabber_offset).toBe(0);
    expect(slider.draws).toBeUndefined();
  });
});

describe('the hex row', () => {
  it('shows "Hex", a flat "#" and the hex code of a colour a hex code holds (:1328-1334)', () => {
    const n = picker({ color: 'Color(1, 0.5, 0, 1)' });
    expect(propsOf<{ text?: string }>(at(n, 'hex_hbc', 'hex_label')).text).toBe('Hex');
    expect(propsOf<ButtonProperties>(at(n, 'hex_hbc', 'text_type'))).toMatchObject({ text: '#', flat: true });
    expect(propsOf<LineEditProperties>(at(n, 'hex_hbc', 'c_text')).text).toBe('ff8000');
  });

  it('shows "Expr" and a disabled color_script for an HDR colour (:1320-1327)', () => {
    const n = picker({ color: 'Color(2, 0, 0, 1)' });
    expect(propsOf<{ text?: string }>(at(n, 'hex_hbc', 'hex_label')).text).toBe('Expr');
    const textType = propsOf<ButtonProperties>(at(n, 'hex_hbc', 'text_type'));
    expect(textType.themeIcon?.name).toBe('color_script');
    expect(textType.disabled).toBe(true);
  });
});

describe('the swatches rows', () => {
  it('shows the Swatches and Recent Colors toggles with folded_arrow, and hides both preset rows (:2224-2287)', () => {
    const swatches = at(picker(), 'swatches_vbc');
    const shown = swatches.children.filter(isShown).map((c) => c.node.name);
    expect(shown).toEqual(['palette_box', 'btn_recent_preset']);
    const preset = propsOf<ButtonProperties>(at(picker(), 'swatches_vbc', 'palette_box', 'btn_preset'));
    expect(preset).toMatchObject({ text: 'Swatches', flat: true, alignment: 0 });
    expect(preset.themeIcon?.name).toBe('folded_arrow');
  });
});

describe("the picker's Buttons read the theme an authored Button reads", () => {
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const GREEN = { r: 0, g: 1, b: 0, a: 1 };
  const themed = () => ({
    ...picker(),
    themeChain: [themeResource({ colors: { Button: { font_color: RED, font_focus_color: GREEN } } })],
  });

  it.each([
    ['sample_hbc', 'btn_pick'],
    ['mode_hbc', 'mode_btn_1'],
    ['hex_hbc', 'text_type'],
  ])("gives %s/%s the theme's Button font_color", (row, button) => {
    expect(at(themed(), row, button).colors.font_color).toEqual(RED);
  });

  it("gives a MenuButton the theme's Button colours through its class chain", () => {
    expect(at(themed(), 'sample_hbc', 'btn_shape').colors.font_color).toEqual(RED);
  });

  it("gives a mode button the theme's Button focus colour", () => {
    expect(at(themed(), 'mode_hbc', 'mode_btn_2').colors.font_focus_color).toEqual(GREEN);
  });

  it("gives a mode button, which sets no icon of its own, the theme's Button icon", () => {
    const n = {
      ...picker(),
      themeChain: [themeResource({ icons: { Button: { icon: 'ExtResource("1")' } } })],
    };
    expect(at(n, 'mode_hbc', 'mode_btn_1').icons.icon?.ref).toBe('ExtResource("1")');
  });

  it.each([
    ['sample_hbc', 'btn_pick'],
    ['mode_hbc', 'mode_btn_2'],
    ['swatches_vbc', 'btn_recent_preset'],
  ])(
    'solves %s/%s with the registered Button solver, so a Button fix such as label wrap reaches it',
    (row, button) => {
      const { type } = at(picker(), row, button).node;
      expect(controlSolverRegistry.minimumSize('Button')).toBeDefined();
      expect(controlSolverRegistry.minimumSize(type)).toBe(controlSolverRegistry.minimumSize('Button'));
    }
  );
});

describe("the ColorPicker's minimum size", () => {
  const minimumOf = (props: Partial<ColorPickerProperties> = {}) =>
    controlSolverRegistry.minimumSize('ColorPicker')!(picker(props), createSolveContext(THEME, measureText));

  // Godot 4.6.3: `ColorPicker.new().get_combined_minimum_size()` after two frames, at theme scale 1.
  it.each([
    ['the default picker', {}, { x: 298, y: 607 }],
    ['SHAPE_NONE', { pickerShape: ColorPickerShape.SHAPE_NONE }, { x: 221, y: 351 }],
    ['the HSV wheel', { pickerShape: ColorPickerShape.SHAPE_HSV_WHEEL }, { x: 264, y: 607 }],
    ['sliders_visible off', { slidersVisible: false }, { x: 298, y: 432 }],
    ['edit_alpha off', { editAlpha: false }, { x: 298, y: 572 }],
    ['OKHSL mode', { colorMode: ColorPickerColorMode.MODE_OKHSL }, { x: 298, y: 607 }],
  ])('is what Godot measures for %s', (_case, props, size) => {
    expect(minimumOf(props)).toEqual(size);
  });
});
