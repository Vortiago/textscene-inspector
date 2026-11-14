/**
 * The theme items of the Controls `GraphEdit`'s constructor `memnew`s for its toolbar
 * (`scene/gui/graph_edit.cpp:3229-3300`): an `HBoxContainer`, a `Label`, `Button`s with the `FlatButton` variation and a `SpinBox`.
 * Each reads its own class's items through the GraphEdit's ancestor Theme chain
 * (`Control::get_theme_stylebox`, `control.cpp:3078`), not the GraphEdit's own.
 */
import type { Rgba } from '../../../../godot/math/math';
import { perObject } from '../../../../utils/perObject';
import { pickButtonStyleBox, type ToggleDrawState } from '../../../../r3f/controls/native/buttonBase';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { themeItemsOfType, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { lineEditField, type LineEditField } from '../lineedit/nativeSolver';
import { SPIN_BOX_FIELD_VARIATION } from '../spinbox/nativeSolver';

/** `zoom_minus_button->set_theme_type_variation(SceneStringName(FlatButton))` (`graph_edit.cpp:3250`). */
const TOOLBAR_BUTTON_VARIATION = 'FlatButton';

export interface GraphEditToolbarTheme {
  /** The GraphEdit's own `menu_panel`, which `_update_theme_item_cache` gives the toolbar PanelContainer (`graph_edit.cpp:837`). */
  menuPanel: StyleBoxFlatData;
  /** The toolbar Buttons' box by draw state, which `FlatButton` sets in the default theme. */
  buttonBoxes: Readonly<Record<ToggleDrawState, StyleBoxFlatData>>;
  /** The Buttons' colours, which hold the `icon_*_color` items. */
  buttonColors: SolveNode['colors'];
  /** `zoom_label`'s `normal` box, which `Label`'s default theme leaves empty. */
  labelBox: StyleBoxFlatData;
  labelColor: Rgba;
  /** `snapping_distance_spinbox`'s field, a `SpinBoxInnerLineEdit`. */
  field: LineEditField;
  fieldColor: Rgba;
  /** The SpinBox's own colours, which hold `up_icon_modulate` and `down_icon_modulate`. */
  spinBoxColors: SolveNode['colors'];
  /** `menu_hbox`'s `separation`, an `HBoxContainer` item (`graph_edit.cpp:3234`). */
  separation: number;
}

/** Written only by `graphEditToolbarTheme`. A node is replaced when the scene changes. */
const toolbarThemesOf = perObject((_node: SolveNode) => new WeakMap<NativeTheme, GraphEditToolbarTheme>());

/** The toolbar's items for one node and theme, built once: the solver and the painter read the same object. */
export const graphEditToolbarTheme = (n: SolveNode, theme: NativeTheme): GraphEditToolbarTheme =>
  toolbarThemesOf(n).get(theme) ?? buildToolbarTheme(n, theme);

function buildToolbarTheme(n: SolveNode, theme: NativeTheme): GraphEditToolbarTheme {
  const button = themeItemsOfType(n, 'Button', TOOLBAR_BUTTON_VARIATION);
  const label = themeItemsOfType(n, 'Label');
  const field = themeItemsOfType(n, 'LineEdit', SPIN_BOX_FIELD_VARIATION);
  const buttonBox = (state: ToggleDrawState) => pickButtonStyleBox(button.styleBoxes, state, n.rtl);
  const result: GraphEditToolbarTheme = {
    menuPanel: requiredThemeItem(n.styleBoxes, 'menu_panel'),
    buttonBoxes: {
      normal: buttonBox('normal'),
      pressed: buttonBox('pressed'),
      disabled: buttonBox('disabled'),
    },
    buttonColors: button.colors,
    labelBox: requiredThemeItem(label.styleBoxes, 'normal'),
    labelColor: requiredThemeItem(label.colors, 'font_color'),
    field: lineEditField(field),
    fieldColor: requiredThemeItem(field.colors, 'font_color'),
    spinBoxColors: themeItemsOfType(n, 'SpinBox').colors,
    separation: requiredThemeItem(themeItemsOfType(n, 'HBoxContainer').constants, 'separation'),
  };
  toolbarThemesOf(n).set(theme, result);
  return result;
}
