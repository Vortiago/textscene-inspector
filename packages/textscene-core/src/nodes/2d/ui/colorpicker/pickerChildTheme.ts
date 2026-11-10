/**
 * The theme items of the picker's internal Buttons, Labels and LineEdits. Godot `memnew`s them
 * inside the ColorPicker, so each reads its own class's items through the ancestor Theme chain
 * (`Control::get_theme_stylebox`, `control.cpp:3078`), not the ColorPicker's own.
 */
import type { Rgba } from '../../../../godot/math/math';
import { CONTROL_FONT_PRESSED_COLOR } from '../../../../godot/scene/theme';
import { pickButtonStyleBox } from '../../../../r3f/controls/native/buttonBase';
import { internalChildThemeItems } from '../../../../r3f/controls/native/buildSolveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { BUTTON_DEFAULT_FONT_COLOR } from '../button/nativeSolver';
import { LABEL_DEFAULT_FONT_COLOR } from '../label/nativeSolver';
import { LINE_EDIT_DEFAULT_FONT_COLOR, pickLineEditStyleBox } from '../lineedit/nativeSolver';

export interface PickerChildTheme {
  /** `theme` with the Button and LineEdit styleboxes of the Theme chain. */
  theme: NativeTheme;
  labelColor: Rgba;
  buttonColor: Rgba;
  /** `font_pressed_color`, the selected mode button's text. */
  buttonPressedColor: Rgba;
  lineEditColor: Rgba;
}

export function pickerChildTheme(n: SolveNode, theme: NativeTheme): PickerChildTheme {
  const label = internalChildThemeItems(n, 'Label');
  const button = internalChildThemeItems(n, 'Button');
  const lineEdit = internalChildThemeItems(n, 'LineEdit');
  const { widgets } = theme;
  return {
    theme: {
      ...theme,
      widgets: {
        ...widgets,
        button: {
          ...widgets.button,
          normal: pickButtonStyleBox(button.styleBoxes, widgets.button, 'normal', n.rtl),
          disabled: pickButtonStyleBox(button.styleBoxes, widgets.button, 'disabled', n.rtl),
        },
        lineEdit: {
          normal: pickLineEditStyleBox(lineEdit.styleBoxes, widgets.lineEdit, 'normal'),
          readOnly: pickLineEditStyleBox(lineEdit.styleBoxes, widgets.lineEdit, 'read_only'),
        },
      },
    },
    labelColor: label.colors.font_color ?? LABEL_DEFAULT_FONT_COLOR,
    buttonColor: button.colors.font_color ?? BUTTON_DEFAULT_FONT_COLOR,
    buttonPressedColor: button.colors.font_pressed_color ?? CONTROL_FONT_PRESSED_COLOR,
    lineEditColor: lineEdit.colors.font_color ?? LINE_EDIT_DEFAULT_FONT_COLOR,
  };
}
