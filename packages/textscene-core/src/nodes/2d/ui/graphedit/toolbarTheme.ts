/**
 * The theme items of the Controls `GraphEdit`'s constructor `memnew`s for its toolbar
 * (`scene/gui/graph_edit.cpp:3229-3300`): a `Label`, `Button`s with the `FlatButton` variation and a `SpinBox`.
 * Each reads its own class's items through the GraphEdit's ancestor Theme chain
 * (`Control::get_theme_stylebox`, `control.cpp:3078`), not the GraphEdit's own.
 */
import type { Rgba } from '../../../../godot/math/math';
import { perObject } from '../../../../utils/perObject';
import { pickButtonStyleBox, type ToggleDrawState } from '../../../../r3f/controls/native/buttonBase';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { internalChildThemeItems, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { lineEditBoxes, type LineEditBoxes } from '../lineedit/nativeSolver';
import { spinBoxFieldThemeItems } from '../spinbox/nativeSolver';

/** `zoom_minus_button->set_theme_type_variation(SceneStringName(FlatButton))` (`graph_edit.cpp:3250`). */
const TOOLBAR_BUTTON_VARIATION = 'FlatButton';

export interface GraphEditToolbarTheme {
  /** The toolbar Buttons' box by draw state, which `FlatButton` sets in the default theme. */
  buttonBoxes: Readonly<Record<ToggleDrawState, StyleBoxFlatData>>;
  /** The Buttons' colours, which hold the `icon_*_color` items. */
  buttonColors: SolveNode['colors'];
  /** `zoom_label`'s `normal` box, which `Label`'s default theme leaves empty. */
  labelBox: StyleBoxFlatData;
  labelColor: Rgba;
  /** `snapping_distance_spinbox`'s field, a `SpinBoxInnerLineEdit`. */
  fieldBoxes: LineEditBoxes;
  fieldColor: Rgba;
  /** The SpinBox's own colours, which hold `up_icon_modulate` and `down_icon_modulate`. */
  spinBoxColors: SolveNode['colors'];
}

/** Written only by `graphEditToolbarTheme`. A node is replaced when the scene changes. */
const toolbarThemesOf = perObject((_node: SolveNode) => new WeakMap<NativeTheme, GraphEditToolbarTheme>());

/** The toolbar's items for one node and theme, built once: the solver and the painter read the same object. */
export const graphEditToolbarTheme = (n: SolveNode, theme: NativeTheme): GraphEditToolbarTheme =>
  toolbarThemesOf(n).get(theme) ?? buildToolbarTheme(n, theme);

function buildToolbarTheme(n: SolveNode, theme: NativeTheme): GraphEditToolbarTheme {
  const button = internalChildThemeItems(n, 'Button', TOOLBAR_BUTTON_VARIATION);
  const label = internalChildThemeItems(n, 'Label');
  const field = spinBoxFieldThemeItems(n);
  const buttonBox = (state: ToggleDrawState) => pickButtonStyleBox(button.styleBoxes, state, n.rtl);
  const result: GraphEditToolbarTheme = {
    buttonBoxes: {
      normal: buttonBox('normal'),
      pressed: buttonBox('pressed'),
      disabled: buttonBox('disabled'),
    },
    buttonColors: button.colors,
    labelBox: requiredThemeItem(label.styleBoxes, 'normal'),
    labelColor: requiredThemeItem(label.colors, 'font_color'),
    fieldBoxes: lineEditBoxes(field.styleBoxes),
    fieldColor: requiredThemeItem(field.colors, 'font_color'),
    spinBoxColors: internalChildThemeItems(n, 'SpinBox').colors,
  };
  toolbarThemesOf(n).set(theme, result);
  return result;
}
