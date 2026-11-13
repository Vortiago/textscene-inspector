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
import {
  internalChildThemeItems,
  requiredThemeItem,
  type InternalThemeItems,
} from '../../../../r3f/controls/native/themeItems';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { perObject } from '../../../../utils/perObject';
import { spinBoxFieldThemeItems } from '../spinbox/nativeSolver';
import { LINE_EDIT_DEFAULT_FONT_COLOR, pickLineEditStyleBox } from '../lineedit/nativeSolver';

/**
 * `mode_button_normal` and `mode_button_pressed`: `BIND_THEME_ITEM_EXT` binds them to `tab_unselected`
 * and `tab_selected` of `TabContainer` (`color_picker.cpp:2060-2061`). A static preview never
 * hovers, so the `mode_button_hover` bind (`:2062`) is left out.
 */
export interface ModeButtonBoxes {
  normal: StyleBoxFlatData;
  pressed: StyleBoxFlatData;
}

/** The picker's theme, with the boxes of its internal TabContainer binds and HSliders. */
export interface PickerTheme extends NativeTheme {
  modeButtons: ModeButtonBoxes;
  /** The boxes of the internal channel `HSlider`s. */
  channelSlider: SliderBoxes;
}

export interface PickerChildTheme {
  /** `theme` with the Button, FlatMenuButton, TabContainer, HSlider and LineEdit styleboxes of the Theme chain. */
  theme: PickerTheme;
  /** `theme` with the `SpinBox` inner LineEdit's styleboxes, for the slider value fields. */
  valueFieldTheme: NativeTheme;
  valueFieldColor: Rgba;
  labelColor: Rgba;
  buttonColor: Rgba;
  /** The Button items' colours, for the icon modulates (`icon_disabled_color`). */
  buttonColors: SolveNode['colors'];
  /** `font_pressed_color`, the selected mode button's text. */
  buttonPressedColor: Rgba;
  lineEditColor: Rgba;
}

function withLineEditBoxes<T extends NativeTheme>(theme: T, items: InternalThemeItems): T {
  const { lineEdit } = theme.widgets;
  return {
    ...theme,
    widgets: {
      ...theme.widgets,
      lineEdit: {
        normal: pickLineEditStyleBox(items.styleBoxes, lineEdit, 'normal'),
        readOnly: pickLineEditStyleBox(items.styleBoxes, lineEdit, 'read_only'),
      },
    },
  };
}

/**
 * The picker's child items for one theme, built once for each node and theme: the painter and
 * `colorPickerMinimumSize` read the same object.
 */
export const pickerChildTheme = (n: SolveNode, nativeTheme: NativeTheme): PickerChildTheme =>
  childThemesOf(n).get(nativeTheme) ?? buildPickerChildTheme(n, nativeTheme);

const childThemesOf = perObject((_node: SolveNode) => new WeakMap<NativeTheme, PickerChildTheme>());

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
  const { widgets } = theme;
  const withBoxes: PickerTheme = {
    ...theme,
    widgets: {
      ...widgets,
      button: {
        ...widgets.button,
        normal: pickButtonStyleBox(button.styleBoxes, 'normal', n.rtl),
        disabled: pickButtonStyleBox(button.styleBoxes, 'disabled', n.rtl),
      },
      flatMenuButton: {
        normal: pickButtonStyleBox(flatMenuButton.styleBoxes, 'normal', n.rtl),
        disabled: pickButtonStyleBox(flatMenuButton.styleBoxes, 'disabled', n.rtl),
      },
    },
    modeButtons: {
      normal: pickTabStyleBox(tabs.styleBoxes, 'unselected'),
      pressed: pickTabStyleBox(tabs.styleBoxes, 'selected'),
    },
    channelSlider: sliderBoxes(slider.styleBoxes),
  };
  const result: PickerChildTheme = {
    theme: withLineEditBoxes(withBoxes, lineEdit),
    valueFieldTheme: withLineEditBoxes(theme, valueField),
    valueFieldColor: valueField.colors.font_color ?? LINE_EDIT_DEFAULT_FONT_COLOR,
    labelColor: requiredThemeItem(label.colors, 'font_color'),
    buttonColor: requiredThemeItem(button.colors, 'font_color'),
    buttonPressedColor: requiredThemeItem(button.colors, 'font_pressed_color'),
    buttonColors: button.colors,
    lineEditColor: lineEdit.colors.font_color ?? LINE_EDIT_DEFAULT_FONT_COLOR,
  };
  childThemesOf(n).set(theme, result);
  return result;
}
