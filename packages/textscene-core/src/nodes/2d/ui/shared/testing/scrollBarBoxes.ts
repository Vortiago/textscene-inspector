/** The default theme table's scroll bar boxes, for a test that drives the geometry without a node. */
import { defaultThemeAt } from '../../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../../r3f/controls/native/defaultThemeRecords';
import { scrollBarBoxes } from '../scrollBarBoxes';
import type { ScrollBarPairBoxes } from '../scrollBarSolver';

export function defaultScrollBarBoxes(scale = 1): ScrollBarPairBoxes {
  const styleBoxes = defaultStyleBoxesOf(defaultThemeAt(scale));
  return {
    horizontal: scrollBarBoxes(styleBoxes.HScrollBar!),
    vertical: scrollBarBoxes(styleBoxes.VScrollBar!),
  };
}
