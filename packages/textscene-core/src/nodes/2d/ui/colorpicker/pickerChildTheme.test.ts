/** The picker's internal Label, Button and LineEdit read their own class's items through the Theme chain. */
import { describe, expect, it } from 'vitest';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import { CONTROL_FONT_COLOR, CONTROL_FONT_PRESSED_COLOR } from '../../../../godot/scene/theme';
import type { TscnInternalResource } from '../../../../parser/types';
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../r3f/controls/native/defaultThemeRecords';
import { pickerChildTheme } from './pickerChildTheme';

const THEME = nativeTheme(1);
const DEFAULT_BOXES = defaultStyleBoxesOf(defaultThemeAt(1));
const RED = { r: 1, g: 0, b: 0, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function themeWithColors(colors: Record<string, Record<string, typeof RED>>): ThemeResource {
  return themeResource({ colors });
}

function pickerUnder(...themeChain: ThemeResource[]): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'Picker',
    node: controlNode('Picker', 'ColorPicker'),
    themeChain,
  });
}

describe('pickerChildTheme', () => {
  it('builds once for each node and theme, so the painter and the minimum size share it', () => {
    const picker = pickerUnder();
    expect(pickerChildTheme(picker, THEME)).toBe(pickerChildTheme(picker, THEME));
    expect(pickerChildTheme(picker, nativeTheme(2))).not.toBe(pickerChildTheme(picker, THEME));
  });

  it('reads the default colours without a Theme', () => {
    const child = pickerChildTheme(pickerUnder(), THEME);
    expect(child.labelColor).toEqual(WHITE);
    expect(child.buttonColor).toEqual(CONTROL_FONT_COLOR);
    expect(child.buttonPressedColor).toEqual(CONTROL_FONT_PRESSED_COLOR);
    expect(child.lineEditColor).toEqual(CONTROL_FONT_COLOR);
  });

  it('gives the labels the font_color of Label from an ancestor Theme', () => {
    const child = pickerChildTheme(pickerUnder(themeWithColors({ Label: { font_color: RED } })), THEME);
    expect(child.labelColor).toEqual(RED);
  });

  it('gives the mode and preset buttons the font colours of Button', () => {
    const colors = { Button: { font_color: GREEN, font_pressed_color: BLUE } };
    const child = pickerChildTheme(pickerUnder(themeWithColors(colors)), THEME);
    expect(child.buttonColor).toEqual(GREEN);
    expect(child.buttonPressedColor).toEqual(BLUE);
  });

  it('gives the value and hex fields the font_color of LineEdit', () => {
    const child = pickerChildTheme(pickerUnder(themeWithColors({ LineEdit: { font_color: BLUE } })), THEME);
    expect(child.lineEditColor).toEqual(BLUE);
  });

  it('gives the slider value fields the SpinBoxInnerLineEdit variation, and the hex field plain LineEdit', () => {
    const base = themeWithColors({
      LineEdit: { font_color: RED },
      SpinBoxInnerLineEdit: { font_color: BLUE },
    });
    const child = pickerChildTheme(
      pickerUnder({ ...base, typeVariations: { SpinBoxInnerLineEdit: 'LineEdit' } }),
      THEME
    );
    expect(child.valueFieldColor).toEqual(BLUE);
    expect(child.lineEditColor).toEqual(RED);
  });

  it('does not read the colour of another class', () => {
    const child = pickerChildTheme(pickerUnder(themeWithColors({ Button: { font_color: RED } })), THEME);
    expect(child.labelColor).toEqual(WHITE);
    expect(child.lineEditColor).toEqual(CONTROL_FONT_COLOR);
  });

  describe('the styleboxes', () => {
    const box: TscnInternalResource = {
      id: 'box',
      type: 'StyleBoxFlat',
      data: {
        content_margin_left: '10.0',
        content_margin_top: '9.0',
        content_margin_right: '10.0',
        content_margin_bottom: '9.0',
      },
    };
    const themed = (styles: Record<string, Record<string, string>>) =>
      pickerUnder({
        ...themeWithColors({}),
        styles,
        resources: { externalResources: [], internalResources: [box] },
      });

    it('gives the mode and preset buttons the normal and disabled styleboxes of Button', () => {
      const child = pickerChildTheme(
        themed({ Button: { normal: 'SubResource("box")', disabled: 'SubResource("box")' } }),
        THEME
      );
      expect(child.theme.button.normal.contentMargin).toEqual({
        left: 10,
        top: 9,
        right: 10,
        bottom: 9,
      });
      expect(child.theme.button.disabled.contentMargin).toEqual({
        left: 10,
        top: 9,
        right: 10,
        bottom: 9,
      });
    });

    it('gives the value and hex fields the normal and read_only styleboxes of LineEdit', () => {
      const child = pickerChildTheme(
        themed({ LineEdit: { normal: 'SubResource("box")', read_only: 'SubResource("box")' } }),
        THEME
      );
      expect(child.theme.lineEdit.normal.contentMargin.left).toBe(10);
      expect(child.theme.lineEdit.readOnly.contentMargin.left).toBe(10);
    });

    it('gives the shape, mode and menu buttons the normal and disabled styleboxes of FlatMenuButton', () => {
      const child = pickerChildTheme(
        themed({ FlatMenuButton: { normal: 'SubResource("box")', disabled: 'SubResource("box")' } }),
        THEME
      );
      expect(child.theme.flatMenuButton.normal.contentMargin.left).toBe(10);
      expect(child.theme.flatMenuButton.disabled.contentMargin.top).toBe(9);
      expect(child.theme.button.normal).toBe(DEFAULT_BOXES.Button!.normal);
    });

    it('gives the mode buttons the tab_unselected and tab_selected styleboxes of TabContainer', () => {
      const child = pickerChildTheme(
        themed({
          TabContainer: { tab_unselected: 'SubResource("box")', tab_selected: 'SubResource("box")' },
        }),
        THEME
      );
      expect(child.theme.modeButtons.normal.contentMargin.left).toBe(10);
      expect(child.theme.modeButtons.pressed.contentMargin.bottom).toBe(9);
    });

    it('gives the channel sliders the slider and grabber_area styleboxes of HSlider', () => {
      const child = pickerChildTheme(
        themed({ HSlider: { slider: 'SubResource("box")', grabber_area: 'SubResource("box")' } }),
        THEME
      );
      expect(child.theme.channelSlider.slider.contentMargin.left).toBe(10);
      expect(child.theme.channelSlider.grabberArea.contentMargin.bottom).toBe(9);
    });

    it('keeps the default styleboxes without an override', () => {
      const child = pickerChildTheme(themed({}), THEME);
      expect(child.theme.button.normal).toBe(DEFAULT_BOXES.Button!.normal);
      expect(child.theme.flatMenuButton.normal).toBe(DEFAULT_BOXES.FlatMenuButton!.normal);
    });
  });
});
