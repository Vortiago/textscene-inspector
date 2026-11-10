/** The picker's internal Label, Button and LineEdit read their own class's items through the Theme chain. */
import { describe, expect, it } from 'vitest';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { CONTROL_FONT_COLOR, CONTROL_FONT_PRESSED_COLOR } from '../../../../godot/scene/theme';
import { pickerChildTheme } from './pickerChildTheme';

const THEME = nativeTheme(1);
const RED = { r: 1, g: 0, b: 0, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function themeWithColors(colors: Record<string, Record<string, typeof RED>>): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    typeVariations: {},
    properties: {},
    colors,
  };
}

function pickerUnder(...themeChain: ThemeResource[]): SolveNode {
  return { ...solveNode(), path: 'Picker', node: controlNode('Picker', 'ColorPicker'), themeChain };
}

describe('pickerChildTheme', () => {
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

  it('does not read the colour of another class', () => {
    const child = pickerChildTheme(pickerUnder(themeWithColors({ Button: { font_color: RED } })), THEME);
    expect(child.labelColor).toEqual(WHITE);
    expect(child.lineEditColor).toEqual(CONTROL_FONT_COLOR);
  });
});
