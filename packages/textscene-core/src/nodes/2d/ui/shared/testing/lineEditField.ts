/** The default theme table's LineEdit field items, for a test that drives a minimum size without a node. */
import { defaultThemeAt } from '../../../../../godot/scene/defaultTheme/defaultTheme';
import {
  defaultConstantsOf,
  defaultStyleBoxesOf,
} from '../../../../../r3f/controls/native/defaultThemeRecords';
import { lineEditField, type LineEditField } from '../../lineedit/nativeSolver';

export function defaultLineEditField(scale = 1): LineEditField {
  const theme = defaultThemeAt(scale);
  return lineEditField({
    styleBoxes: defaultStyleBoxesOf(theme).LineEdit!,
    constants: defaultConstantsOf(theme).LineEdit!,
  });
}
