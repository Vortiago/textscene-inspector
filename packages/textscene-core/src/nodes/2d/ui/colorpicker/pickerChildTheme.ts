/**
 * The theme items of the picker's internal Buttons, Labels and LineEdits. Godot `memnew`s them
 * inside the ColorPicker, so each reads its own class's items through the ancestor Theme chain
 * (`Control::get_theme_stylebox`, `control.cpp:3078`), not the ColorPicker's own.
 */
import { sliderBoxes, type SliderBoxes } from '../shared/sliderSolver';
import { pickTabStyleBox } from '../tabbar/nativeSolver';
import type { Rgba } from '../../../../godot/math/math';
import { DEFAULT_THEME_VARIATION_BASES } from '../../../../godot/scene/defaultTheme/variations';
import { pickButtonStyleBox } from '../../../../r3f/controls/native/buttonBase';
import { internalChildThemeItems, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { perObject } from '../../../../utils/perObject';
import { spinBoxFieldThemeItems } from '../spinbox/nativeSolver';
import { lineEditField, type LineEditField } from '../lineedit/nativeSolver';

/**
 * `mode_button_normal` and `mode_button_pressed`: `BIND_THEME_ITEM_EXT` binds them to `tab_unselected`
 * and `tab_selected` of `TabContainer` (`color_picker.cpp:2060-2061`). A static preview never
 * hovers, so the `mode_button_hover` bind (`:2062`) is left out.
 */
export interface ModeButtonBoxes {
  normal: StyleBoxFlatData;
  pressed: StyleBoxFlatData;
}

/** A Button's `normal` and `disabled` boxes: a static preview draws no other state of an internal Button. */
export interface ButtonBoxes {
  normal: StyleBoxFlatData;
  disabled: StyleBoxFlatData;
}

/** The ColorPicker's own constants (`color_picker.cpp:145-165`, `color_picker_shape.cpp:465-509`). */
export interface PickerSizes {
  /** `margin`: the `content_margin` of `internal_margin` on every side. */
  margin: number;
  svWidth: number;
  svHeight: number;
  /** `h_width`: the width of the hue or value slider beside the shape. */
  hWidth: number;
  /** `label_width`: the floor of the channel label column. */
  labelWidth: number;
}

function pickerSizes(constants: SolveNode['constants']): PickerSizes {
  return {
    margin: requiredThemeItem(constants, 'margin'),
    svWidth: requiredThemeItem(constants, 'sv_width'),
    svHeight: requiredThemeItem(constants, 'sv_height'),
    hWidth: requiredThemeItem(constants, 'h_width'),
    labelWidth: requiredThemeItem(constants, 'label_width'),
  };
}

/** The picker's theme, with its own constants and the boxes of its internal Buttons, TabContainer binds, HSliders and hex LineEdit. */
export interface PickerTheme extends NativeTheme {
  sizes: PickerSizes;
  /** The internal Buttons' boxes: the screen picker, the preset and the text type buttons. */
  button: ButtonBoxes;
  /** The internal MenuButtons' boxes, which take the `FlatMenuButton` variation. */
  flatMenuButton: ButtonBoxes;
  modeButtons: ModeButtonBoxes;
  /** The hex field's boxes, a plain `LineEdit`. */
  lineEdit: LineEditField;
  /** The boxes of the internal channel `HSlider`s. */
  channelSlider: SliderBoxes;
}

export interface PickerChildTheme {
  /** `theme` with the Button, FlatMenuButton, TabContainer, HSlider and LineEdit styleboxes of the Theme chain. */
  theme: PickerTheme;
  /** The `SpinBox` inner LineEdit's boxes, for the slider value fields. */
  valueField: LineEditField;
  valueFieldColor: Rgba;
  /** The `SpinBox` items' colours, for the value fields' arrow modulates. */
  spinBoxColors: SolveNode['colors'];
  labelColor: Rgba;
  buttonColor: Rgba;
  /** The Button items' colours, for the icon modulates (`icon_disabled_color`). */
  buttonColors: SolveNode['colors'];
  /** `font_pressed_color`, the selected mode button's text. */
  buttonPressedColor: Rgba;
  lineEditColor: Rgba;
}

/**
 * The picker's child items for one theme, built once for each node and theme: the painter and
 * `colorPickerMinimumSize` read the same object.
 */
export const pickerChildTheme = (n: SolveNode, nativeTheme: NativeTheme): PickerChildTheme =>
  childThemesOf(n).get(nativeTheme) ?? buildPickerChildTheme(n, nativeTheme);

const childThemesOf = perObject((_node: SolveNode) => new WeakMap<NativeTheme, PickerChildTheme>());

function buttonBoxes(styleBoxes: SolveNode['styleBoxes'], rtl: boolean): ButtonBoxes {
  return {
    normal: pickButtonStyleBox(styleBoxes, 'normal', rtl),
    disabled: pickButtonStyleBox(styleBoxes, 'disabled', rtl),
  };
}

function buildPickerChildTheme(n: SolveNode, theme: NativeTheme): PickerChildTheme {
  const label = internalChildThemeItems(n, 'Label');
  const button = internalChildThemeItems(n, 'Button');
  const flatMenuButton = internalChildThemeItems(
    n,
    DEFAULT_THEME_VARIATION_BASES.FlatMenuButton!,
    'FlatMenuButton'
  );
  const lineEdit = internalChildThemeItems(n, 'LineEdit');
  const valueField = spinBoxFieldThemeItems(n);
  const tabs = internalChildThemeItems(n, 'TabContainer');
  const slider = internalChildThemeItems(n, 'HSlider');
  const withBoxes: PickerTheme = {
    ...theme,
    sizes: pickerSizes(n.constants),
    button: buttonBoxes(button.styleBoxes, n.rtl),
    flatMenuButton: buttonBoxes(flatMenuButton.styleBoxes, n.rtl),
    modeButtons: {
      normal: pickTabStyleBox(tabs.styleBoxes, 'unselected'),
      pressed: pickTabStyleBox(tabs.styleBoxes, 'selected'),
    },
    channelSlider: sliderBoxes(slider.styleBoxes),
    lineEdit: lineEditField(lineEdit),
  };
  const result: PickerChildTheme = {
    theme: withBoxes,
    valueField: lineEditField(valueField),
    valueFieldColor: requiredThemeItem(valueField.colors, 'font_color'),
    spinBoxColors: internalChildThemeItems(n, 'SpinBox').colors,
    labelColor: requiredThemeItem(label.colors, 'font_color'),
    buttonColor: requiredThemeItem(button.colors, 'font_color'),
    buttonPressedColor: requiredThemeItem(button.colors, 'font_pressed_color'),
    buttonColors: button.colors,
    lineEditColor: requiredThemeItem(lineEdit.colors, 'font_color'),
  };
  childThemesOf(n).set(theme, result);
  return result;
}
